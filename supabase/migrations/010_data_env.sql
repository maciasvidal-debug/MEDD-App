-- =====================================================================
-- MEDD-App — Separación piloto vs producción en un ÚNICO backend
--
-- Estrategia: un discriminador de ambiente (`data_env`) por CUENTA (fuente de
-- verdad) que un trigger estampa en cada encuesta al INSERTAR. Es
-- server-authoritative: la app no puede falsificarlo. Default 'pilot' por
-- seguridad (nada cae en producción por accidente; producción es una decisión
-- explícita del administrador en el cutover).
--
-- Esta migración es ADITIVA y NO disruptiva: no cambia qué puede leer nadie.
-- El AISLAMIENTO de lectura (RLS) se aplica en el go-live → 011_data_env_rls_cutover.sql
-- Idempotente: seguro de re-ejecutar.
-- =====================================================================

-- 1. Ambiente por cuenta (fuente de verdad).
alter table public.user_profiles
  add column if not exists data_env text not null default 'pilot';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_data_env_check') then
    alter table public.user_profiles
      add constraint user_profiles_data_env_check check (data_env in ('pilot', 'prod'));
  end if;
end $$;

-- 2. Helper: ambiente de la cuenta actual (coalesce a 'pilot' si no hay perfil).
--    SECURITY DEFINER para que el trigger y las políticas RLS lo evalúen sin
--    depender de las políticas de user_profiles. Solo devuelve el ambiente del
--    propio usuario, así que es seguro.
create or replace function public.get_my_data_env()
returns text
language sql stable
security definer set search_path = ''
as $$
  select coalesce(
    (select data_env from public.user_profiles where user_id = (select auth.uid())),
    'pilot'
  )
$$;

-- 3. Ambiente por encuesta + trigger que lo estampa desde la cuenta (inmutable).
alter table public.surveys
  add column if not exists data_env text not null default 'pilot';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'surveys_data_env_check') then
    alter table public.surveys
      add constraint surveys_data_env_check check (data_env in ('pilot', 'prod'));
  end if;
end $$;

create index if not exists idx_surveys_data_env on public.surveys(data_env);

create or replace function public.stamp_survey_data_env()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Server-authoritative: se ignora lo que envíe el cliente.
  new.data_env := public.get_my_data_env();
  return new;
end;
$$;

drop trigger if exists trg_stamp_survey_data_env on public.surveys;
create trigger trg_stamp_survey_data_env
  before insert on public.surveys
  for each row execute function public.stamp_survey_data_env();

comment on column public.surveys.data_env      is 'Ambiente de datos: pilot | prod (estampado server-side al insertar).';
comment on column public.user_profiles.data_env is 'Ambiente de la cuenta: pilot | prod. Fuente de verdad del discriminador.';
