-- =====================================================================
-- MEDD-App — Back-check (re-entrevista de control de calidad)
--
-- Un back-check es una encuesta normal que apunta a la ORIGINAL que re-verifica.
-- Comparar respuestas original vs back-check mide la fiabilidad inter-observador
-- (κ / ICC de acuerdo) y detecta fabricación (curbstoning). ADITIVA y no
-- disruptiva. Idempotente.
-- =====================================================================

alter table public.surveys
  add column if not exists backcheck_of uuid references public.surveys(id) on delete set null;

create index if not exists idx_surveys_backcheck_of on public.surveys(backcheck_of);

comment on column public.surveys.backcheck_of is
  'Re-entrevista de control: apunta a la encuesta original re-verificada (NULL = captura normal).';
