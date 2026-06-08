-- =====================================================================
-- MEDD-App — Para-data: marca de inicio de la captura
--
-- started_at = momento en que se abrió el asistente para capturar la
-- encuesta. Junto con created_at (envío) permite derivar la DURACIÓN de la
-- entrevista, un control de calidad / antifraude: entrevistas demasiado
-- rápidas son una señal de fabricación (curbstoning). Nullable: las encuestas
-- capturadas antes de esta columna no tienen valor.
-- Idempotente: seguro de re-ejecutar.
-- =====================================================================

alter table public.surveys
  add column if not exists started_at timestamptz;

comment on column public.surveys.started_at is
  'Para-data: inicio de la captura (apertura del asistente). Duración = created_at − started_at.';
