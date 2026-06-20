-- =====================================================================
-- MEDD-App — 013 Batería de motivos / disposición (instrumento v2)
--
-- Añade, a mitad de estudio, las preguntas sobre POR QUÉ los hogares
-- conservan medicamentos sin consumir / vencidos y QUÉ hacen con ellos.
-- Todo es ADITIVO y NULLABLE: los registros previos (instrumento v1)
-- quedan en NULL y la app los interpreta como «No preguntado» (distinto
-- de «No»/[]), apoyándose en surveys.instrument_version.
--
-- ⚠️ ORDEN DE DESPLIEGUE (evita romper la sincronización):
--   1) APLICAR ESTA MIGRACIÓN primero. El cliente nuevo hace upsert con
--      estas columnas; si aún no existen, Supabase rechaza el upsert y la
--      sincronización fallaría hasta aplicarla.
--   2) Desplegar el frontend que captura estos campos.
--
-- Idempotente: add column if not exists. Sin backfill (NULL = v1).
-- Las columnas multivalor se guardan como jsonb (igual que medications).
-- =====================================================================

alter table public.surveys
  add column if not exists instrument_version   integer,
  add column if not exists mot_no_consumo        jsonb,
  add column if not exists mot_no_consumo_otro   text,
  add column if not exists mot_vencimiento       jsonb,
  add column if not exists mot_vencimiento_otro  text,
  add column if not exists disp_final            jsonb,
  add column if not exists disp_final_otro       text,
  add column if not exists conoce_puntos         text,
  add column if not exists cual_punto            text;

comment on column public.surveys.instrument_version is
  'Versión del instrumento al capturar. NULL/1 = sin batería de motivos (v1); 2 = con motivos. Permite separar «No preguntado» de «respuesta vacía».';
comment on column public.surveys.mot_no_consumo  is 'Motivos de no consumo (array). v2.';
comment on column public.surveys.mot_vencimiento is 'Razones de acumulación/vencimiento (array). v2.';
comment on column public.surveys.disp_final      is 'Conducta real de disposición (array). v2.';
comment on column public.surveys.conoce_puntos   is 'Conoce puntos de recolección posconsumo (Sí/No). v2.';
