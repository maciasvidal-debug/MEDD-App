-- =====================================================================
-- MEDD-App — 021 Validaciones de rango en el ESQUEMA (RBQM R7)
--
-- Contexto (piloto):
--   El export del piloto trajo `f_eta` con año 2012 y edades derivadas cercanas a
--   0. Esas validaciones vivían SOLO en el cliente (`validators.ts`, `quality.ts`).
--   Quality by Design / el principio del anexo Supabase exigen que vivan también en
--   la base: es la última línea de defensa si el cliente falla o cambia.
--
-- Qué añade:
--   1) CHECK `chk_f_eta_min`  — f_eta no anterior al inicio del estudio (2024-01-01).
--   2) CHECK `chk_edad_dias`  — 0 ≤ (f_eta − f_nac) ≤ 40177 días (≈110 años). Cubre
--      a la vez «f_nac ≤ f_eta» y «edad ≤ 110». Aritmética de fechas = IMMUTABLE,
--      apta para CHECK.
--   3) TRIGGER `trg_survey_not_future` — rechaza f_eta futura en INSERT/UPDATE.
--      Va como trigger (no CHECK) porque `current_date` no es inmutable y no puede
--      usarse en una restricción CHECK.
--
-- CERO REGRESIONES sobre el piloto:
--   Los CHECK se crean `NOT VALID`: se aplican a TODA escritura nueva pero NO
--   rechazan las filas históricas ya presentes (p. ej. el registro con f_eta=2012).
--   El dato crudo del piloto se preserva intacto; el defecto no puede volver a
--   ENTRAR. La restricción se puede VALIDATE más adelante si se decide sanear/marcar
--   los históricos fuera de rango (decisión del investigador; ver monitoreo R7).
--   El trigger de «no futura» solo evalúa la fila nueva, así que tampoco toca
--   históricos (una fecha pasada del piloto lo pasa trivialmente).
--
--   Nota: un CHECK `NOT VALID` sí se evalúa al RE-GUARDAR una fila histórica; por
--   diseño el dato crudo del piloto es inmutable (no se edita una captura cruda). Si
--   hiciera falta corregir un histórico fuera de rango, deshabilitar temporalmente la
--   restricción es una acción administrativa deliberada, no un flujo de la app.
--
-- Idempotente: guardas `pg_constraint` / `create or replace` / `drop trigger if
-- exists`. Seguro de re-ejecutar.
--
-- Rollback:
--   alter table public.surveys drop constraint if exists chk_f_eta_min;
--   alter table public.surveys drop constraint if exists chk_edad_dias;
--   drop trigger if exists trg_survey_not_future on public.surveys;
--   drop function if exists public.medd_check_f_eta_not_future();
-- =====================================================================

-- 1) f_eta no anterior al inicio del estudio (coincide con STUDY_START del cliente).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_f_eta_min') then
    alter table public.surveys
      add constraint chk_f_eta_min
      check (f_eta is null or f_eta >= date '2024-01-01') not valid;
  end if;
end $$;

-- 2) Edad plausible y coherencia f_nac ≤ f_eta, vía días entre fechas (inmutable).
--    40177 días ≈ 110 años (110 * 365.25).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_edad_dias') then
    alter table public.surveys
      add constraint chk_edad_dias
      check (
        f_eta is null or f_nac is null
        or ((f_eta - f_nac) between 0 and 40177)
      ) not valid;
  end if;
end $$;

-- 3) f_eta no futura (current_date no es inmutable → trigger, no CHECK).
create or replace function public.medd_check_f_eta_not_future()
returns trigger language plpgsql as $$
begin
  if new.f_eta is not null and new.f_eta > current_date then
    raise exception 'f_eta (%) no puede ser una fecha futura', new.f_eta
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_survey_not_future on public.surveys;
create trigger trg_survey_not_future
  before insert or update on public.surveys
  for each row execute function public.medd_check_f_eta_not_future();

comment on constraint chk_f_eta_min on public.surveys is
  'RBQM R7: f_eta no anterior al inicio del estudio (2024-01-01). NOT VALID: preserva históricos del piloto (p. ej. 2012) pero bloquea la re-entrada del defecto.';
comment on constraint chk_edad_dias on public.surveys is
  'RBQM R7: 0 ≤ (f_eta − f_nac) ≤ ~110 años. Cubre f_nac ≤ f_eta y edad plausible. NOT VALID (grandfathering del piloto).';
