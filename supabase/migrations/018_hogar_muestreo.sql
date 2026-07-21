-- =====================================================================
-- MEDD-App — 018 Identificador de hogar y diseño muestral (Sec. 7 Rec. 5)
--
-- Contexto (auditoría del piloto):
--   Se detectó agrupamiento por hogar y por encuestador (ICC≈0,27), pero NO era
--   modelable desde el dato: faltaba un identificador de hogar explícito y no se
--   registraba el método de selección muestral. El clúster de encuestador
--   (nui_etr) ya existía; esta migración añade los dos que faltaban.
--
--   * hogar_id: identificador de hogar estable. Personas del mismo hogar
--     comparten el código (el asistente autogenera uno y el encuestador lo
--     reutiliza para los co-residentes). Habilita modelar el clúster-hogar.
--   * metodo_seleccion: método de selección con el que se eligió el hogar/
--     persona (aleatorio simple, sistemático, conglomerados, conveniencia, otro).
--
-- ADITIVA y NULLABLE: los registros históricos quedan con hogar_id /
-- metodo_seleccion NULL (decisión de la auditoría: NO se back-fillea con una
-- heurística que altere la interpretación; el hogar se puebla desde la próxima
-- ola). No cambia RLS ni lo que puede leer nadie.
--
-- Idempotente: `add column if not exists`, seguro de re-ejecutar.
--
-- Rollback:
--   alter table public.surveys drop column if exists hogar_id;
--   alter table public.surveys drop column if exists metodo_seleccion;
-- =====================================================================

alter table public.surveys
  add column if not exists hogar_id         text,
  add column if not exists metodo_seleccion text;

-- Índice para consultas/joins por clúster de hogar (análisis agrupado).
create index if not exists idx_surveys_hogar_id on public.surveys(hogar_id);

comment on column public.surveys.hogar_id is
  'Identificador de hogar (clúster). Co-residentes comparten código. Habilita modelar el agrupamiento por hogar. NULL en históricos (no back-filleado).';
comment on column public.surveys.metodo_seleccion is
  'Método de selección muestral: Aleatorio simple | Sistemático | Por conglomerados | Por conveniencia | Otro. NULL en históricos.';
