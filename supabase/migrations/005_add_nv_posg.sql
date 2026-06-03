-- =====================================================================
-- MEDD-App — Migración incremental
-- Añade NV_POSG (nivel de formación posgrado) a las variables
-- sociodemográficas. Complementa a NV_ESTU (que llega hasta
-- 'Profesional') para discriminar la formación de posgrado.
-- Idempotente: seguro de re-ejecutar sobre despliegues existentes.
-- =====================================================================

alter table public.surveys
  add column if not exists nv_posg text;
