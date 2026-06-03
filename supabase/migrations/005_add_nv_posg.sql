-- =====================================================================
-- MEDD-App — Migración incremental
-- Añade NV_POSG: sub-nivel de posgrado (Especialización, Maestría,
-- Doctorado) que detalla la opción 'Posgrado' de NV_ESTU. Sólo lleva
-- valor cuando NV_ESTU = 'Posgrado'.
-- Idempotente: seguro de re-ejecutar sobre despliegues existentes.
-- =====================================================================

alter table public.surveys
  add column if not exists nv_posg text;
