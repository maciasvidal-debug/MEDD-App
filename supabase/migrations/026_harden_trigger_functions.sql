-- =====================================================================
-- MEDD-App — 026 Endurecimiento de las funciones de trigger RBQM (seguridad)
--
-- Los advisors de Supabase señalaron, tras aplicar 021/023:
--   * medd_check_f_eta_not_future: search_path mutable (0011).
--   * medd_sync_medicamento_items (SECURITY DEFINER): ejecutable por anon/
--     authenticated vía /rest/v1/rpc (0028/0029).
--
-- Ambas son funciones de TRIGGER: no deben ser invocables por la Data API. Los
-- triggers las ejecutan por el mecanismo de disparo (no por el privilegio EXECUTE
-- del rol), así que revocar EXECUTE NO rompe el trigger; solo cierra la superficie
-- RPC. Además se fija el search_path de la función de rango.
--
-- Idempotente: create or replace + revoke (revoke de un privilegio ausente es
-- inocuo). Rollback: no aplica (endurecimiento; revertirlo reabriría la superficie).
-- =====================================================================

-- 1) Fijar search_path de la función de rango (evita secuestro de resolución).
create or replace function public.medd_check_f_eta_not_future()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.f_eta is not null and new.f_eta > current_date then
    raise exception 'f_eta (%) no puede ser una fecha futura', new.f_eta
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- 2) Quitar la superficie RPC de las funciones de trigger.
revoke execute on function public.medd_check_f_eta_not_future() from public, anon, authenticated;
revoke execute on function public.medd_sync_medicamento_items() from public, anon, authenticated;
