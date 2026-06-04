-- 007_add_surveyor_profile.sql
-- Surveyor (encuestador) profile snapshot, stamped onto each survey at
-- collection time. Enables stratifying/adjusting for interviewer effects and
-- field QC across an expanded surveyor pool (multiple health programs and
-- institutions). All columns are nullable so existing rows and older clients
-- keep working; applied to the remote project on 2026-06-04.

alter table public.surveys
  add column if not exists etr_programa    text,
  add column if not exists etr_tipo_inst   text,
  add column if not exists etr_semestre    smallint,
  add column if not exists etr_institucion text;

-- Keep the academic semester within a sane range when provided.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'surveys_etr_semestre_check'
  ) then
    alter table public.surveys
      add constraint surveys_etr_semestre_check
      check (etr_semestre is null or (etr_semestre >= 1 and etr_semestre <= 12));
  end if;
end $$;

comment on column public.surveys.etr_programa    is 'Programa académico del encuestador (snapshot)';
comment on column public.surveys.etr_tipo_inst   is 'Tipo de institución del encuestador: Pública | Privada';
comment on column public.surveys.etr_semestre    is 'Semestre académico del encuestador (1–12)';
comment on column public.surveys.etr_institucion is 'Institución del encuestador (nombre)';
