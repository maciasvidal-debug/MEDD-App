-- =====================================================================
-- MEDD-App — Correcciones de seguridad (Supabase Advisor)
--
-- 1. get_my_role(): SECURITY DEFINER → SECURITY INVOKER
--    La política RLS "user_reads_own_role" ya permite que cada usuario
--    autenticado lea su propio rol. SECURITY DEFINER no es necesario
--    y expone la función a llamadas no autenticadas con privilegios
--    del propietario.
--
-- 2. handle_new_user(): revocar EXECUTE a anon y authenticated
--    Es exclusivamente una función trigger (INSERT en auth.users).
--    Nunca debe ser invocable directamente vía REST API.
-- =====================================================================

-- ─── 1. get_my_role(): cambiar a SECURITY INVOKER ────────────────────
create or replace function public.get_my_role()
returns public.app_role
language sql stable
security invoker set search_path = ''
as $$
  select role
  from public.user_roles
  where user_id = (select auth.uid())
$$;

-- ─── 2. handle_new_user(): revocar acceso directo ────────────────────
-- Es una función trigger; sólo debe ejecutarse por el motor de triggers,
-- nunca directamente por un rol de aplicación.
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
