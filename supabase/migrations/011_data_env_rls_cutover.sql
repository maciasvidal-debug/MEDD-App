-- =====================================================================
-- MEDD-App — Aislamiento por ambiente (APLICAR EN EL CUTOVER / go-live)
--
-- ⚠️ NO aplicar durante el piloto. Esta migración activa el aislamiento de
-- lectura: limita TODA lectura de `surveys` (y por herencia la vista analítica
-- `v_product_metrics`, que es security_invoker) al ambiente de la cuenta que
-- consulta. La vista hereda el filtro automáticamente.
--
-- Es un NO-OP mientras todas las cuentas/encuestas sean 'pilot' (el caso del
-- piloto): el predicado `data_env = get_my_data_env()` se cumple siempre. Se
-- vuelve efectivo cuando existan cuentas 'prod'.
--
-- Reemplaza la política survey_select preservando su lógica vigente
-- (propietario O investigador) y le añade el filtro de ambiente.
-- Idempotente.
--
-- ── RUNBOOK DE CUTOVER ───────────────────────────────────────────────
--   1) Verificar invariantes:  todas las surveys con data_env esperado;
--      get_my_data_env() correcto por cuenta.
--   2) Promover cuentas de producción:
--        update public.user_profiles set data_env = 'prod' where user_id in (...);
--      (las cuentas sin perfil siguen siendo 'pilot' por el coalesce; crear su
--       perfil o promoverlas explícitamente antes de capturar en producción.)
--   3) Aplicar esta migración.
--   4) Validar como usuario 'prod' (no ve filas 'pilot') y 'pilot' (no ve 'prod').
-- =====================================================================

drop policy if exists "survey_select" on public.surveys;
create policy "survey_select"
  on public.surveys for select
  using (
    (
      (select auth.uid()) = user_id
      or (select public.get_my_role()) = 'investigador'
    )
    and data_env = (select public.get_my_data_env())
  );
