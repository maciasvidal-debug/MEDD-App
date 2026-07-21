-- =====================================================================
-- MEDD-App — 016 Columna `departamento` (corrección de deriva de esquema)
--
-- Contexto (auditoría del piloto, Sec. 7 Rec. 3):
--   El cliente ya escribe `departamento` en cada upsert de encuesta
--   (src/lib/sync-mapping.ts → toRow), derivándolo del catálogo DANE/DIVIPOLA
--   al elegir el municipio. Sin embargo, NINGUNA migración creaba la columna:
--   en un proyecto Supabase reconstruido solo desde `migrations/`, el upsert
--   fallaría ("column surveys.departamento does not exist") y rompería la
--   sincronización. Esta migración cierra esa deriva entre código y esquema.
--
-- Es ADITIVA, NULLABLE y no disruptiva: no cambia RLS ni lo que puede leer
-- nadie, y los registros previos quedan con `departamento` NULL (el municipio
-- canónico ya vive en `ciudad`).
--
-- Idempotente: `add column if not exists`, seguro de re-ejecutar.
--
-- Rollback: `alter table public.surveys drop column if exists departamento;`
--   (solo si se decide revertir; elimina el dato de departamento capturado).
-- =====================================================================

alter table public.surveys
  add column if not exists departamento text;

create index if not exists idx_surveys_departamento on public.surveys(departamento);

comment on column public.surveys.departamento is
  'Departamento DANE de residencia, derivado del municipio (catálogo DIVIPOLA). Se captura aparte para no contaminar `ciudad`. NULL en registros previos a la captura del campo.';
