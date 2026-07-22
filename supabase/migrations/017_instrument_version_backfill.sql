-- =====================================================================
-- MEDD-App — 017 `instrument_version` obligatorio y no nulo (Sec. 7 Rec. 1)
--
-- Contexto (auditoría del piloto):
--   El defecto DOMINANTE del piloto fue mezclar dos versiones del instrumento
--   con `instrument_version` NULL en 105/114 registros. La columna se creó
--   aditiva y nullable en 013_add_motives.sql (NULL ≡ v1), pero nunca se cerró
--   el ciclo: sin back-fill, sin restricción y sin barrera de export, la mezcla
--   de versiones puede repetirse en la próxima ola.
--
-- Esta migración fija la semántica ya documentada (NULL ≡ v1) como INVARIANTE
-- de datos:
--   1) Back-fill: todo registro sin versión es, por definición, del instrumento
--      v1 (anterior a la batería de motivos). Se rellena con 1.
--   2) DEFAULT 1: cualquier inserción que omita la versión queda como v1
--      (defensa; el cliente actual siempre estampa la versión vigente).
--   3) NOT NULL: a partir de aquí, NINGÚN registro puede quedar sin versión.
--
-- Orden importante: back-fill ANTES de NOT NULL (si no, el ALTER falla con
-- filas NULL preexistentes).
--
-- Idempotente: el back-fill solo toca NULLs (re-ejecutar no cambia nada); el
-- DEFAULT y el NOT NULL son declarativos (reaplicarlos es inocuo).
--
-- Rollback:
--   alter table public.surveys alter column instrument_version drop not null;
--   alter table public.surveys alter column instrument_version drop default;
--   -- Nota: el back-fill (NULL→1) NO se revierte porque un 1 back-filleado es
--   -- indistinguible de un 1 legítimo; y 1 es la interpretación correcta de un
--   -- registro v1, así que revertirlo no aporta valor y sí reintroduce el defecto.
-- =====================================================================

-- 1) Back-fill: NULL ≡ instrumento v1.
update public.surveys
   set instrument_version = 1
 where instrument_version is null;

-- 2) Default para inserciones que omitan la versión.
alter table public.surveys
  alter column instrument_version set default 1;

-- 3) Invariante: no más versiones nulas.
alter table public.surveys
  alter column instrument_version set not null;

comment on column public.surveys.instrument_version is
  'Versión del instrumento al capturar. OBLIGATORIA y NO NULA: 1 = sin batería de motivos (v1); 2 = con motivos. Back-fill 017 fijó los históricos NULL→1. Permite separar «No preguntado» (v1) de «respuesta vacía» (v2).';
