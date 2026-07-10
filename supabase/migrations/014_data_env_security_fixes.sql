-- =====================================================================
-- MEDD-App — Correcciones de seguridad de los helpers de `data_env`
-- (Supabase Advisor: lints 0028 / 0029)
--
-- El Advisor marca dos funciones `SECURITY DEFINER` del módulo `data_env`
-- como invocables vía REST (`/rest/v1/rpc/...`) por los roles `anon` y
-- `authenticated`. Ninguna está pensada para ser un endpoint público:
-- ambas son helpers internos de la RLS y del trigger de encuestas, y la app
-- nunca las llama directamente (solo lee la columna `data_env`).
--
-- Se aplican los MISMOS patrones ya usados en 003_security_fixes.sql:
--
--   1. get_my_data_env()  → como get_my_role(): SECURITY DEFINER → INVOKER.
--      La política `profile_select_own` (008_user_profiles.sql) ya permite
--      que cada usuario lea su propio perfil, de modo que la función devuelve
--      el mismo valor sin necesidad de privilegios del propietario. Al dejar
--      de ser SECURITY DEFINER, el lint desaparece. Sigue evaluándose
--      correctamente dentro del trigger (que es SECURITY DEFINER y omite la
--      RLS) y dentro de la política RLS de `surveys` (auth.uid() del llamante).
--
--   2. stamp_survey_data_env() → como handle_new_user(): revocar EXECUTE.
--      Es exclusivamente una función trigger (BEFORE INSERT en surveys); el
--      motor de triggers la ejecuta sin requerir EXECUTE del rol llamante, así
--      que nunca debe ser invocable directamente vía REST API. Supabase concede
--      EXECUTE tanto a PUBLIC como a `anon`/`authenticated` de forma directa,
--      por lo que hay que revocar de los tres.
--
-- Idempotente: seguro de re-ejecutar.
-- =====================================================================

-- ─── 1. get_my_data_env(): SECURITY DEFINER → SECURITY INVOKER ───────
create or replace function public.get_my_data_env()
returns text
language sql stable
security invoker set search_path = ''
as $$
  select coalesce(
    (select data_env from public.user_profiles where user_id = (select auth.uid())),
    'pilot'
  )
$$;

-- ─── 2. stamp_survey_data_env(): revocar acceso directo ──────────────
-- Función trigger; sólo debe ejecutarse por el motor de triggers. Supabase
-- concede EXECUTE a PUBLIC y también a anon/authenticated de forma directa,
-- así que hay que revocar de los tres para cerrar el endpoint REST.
revoke execute on function public.stamp_survey_data_env() from public, anon, authenticated;
