-- =====================================================================
-- MEDD-App — 023 Inventario normalizado: tabla hija medicamento_item (RBQM R5)
--
-- Contexto (piloto): el inventario de medicamentos fue el activo más valioso del
-- estudio (permitió ver que los antibióticos son la clase sobrante más frecuente).
-- Hoy se almacena EMBEBIDO como `surveys.medications` (jsonb). Mejor práctica de
-- ingeniería y farmacoepidemiología (decisión del stakeholder, 2026-07-25): un
-- inventario NORMALIZADO, una fila por medicamento, con columnas tipadas —
-- integridad referencial, joins limpios y estado de vencimiento por ítem.
--
-- Diseño (robustez sobre la arquitectura offline-first):
--   El cliente sigue escribiendo SOLO el jsonb (modelo local y sync intactos;
--   cero regresión). La base MATERIALIZA la tabla hija vía TRIGGER que explota
--   `medications` a filas tipadas en cada insert/update de la encuesta. Así todo
--   el control R5 vive en el esquema (última línea de defensa del anexo), sin
--   puntos de fallo nuevos en el cliente ni doble escritura desde la app.
--
--   * medicamento_item: fila por medicamento, tipada. peso_g NO se incluye: la
--     app captura el peso a nivel de ENCUESTA (peso_med_nc), no por ítem — no se
--     inventa un peso por ítem que no existe en el dato.
--   * atc_codigo: columna NULLABLE, reservada. No se puebla aquí: la clasificación
--     ATC vive en el cliente (atc.ts, nivel 1/2) y su persistencia trazable se
--     evaluará aparte; no se generan códigos de memoria (cláusula anti-alucinación).
--   * v_medicamento_estado: estado de vencimiento por ítem CONTRA la fecha de
--     encuesta (sin_fecha | vencido | vence_6m | vigente), como pide el anexo.
--
-- Idempotente: create table/or replace/if not exists; el back-fill solo inserta
-- para encuestas aún no explotadas (not exists); el trigger es create or replace.
-- SECURITY DEFINER en la función para que la materialización no la bloquee la RLS
-- de la tabla hija (que solo expone SELECT al dueño de la encuesta).
--
-- Rollback:
--   drop view if exists public.v_medicamento_estado;
--   drop trigger if exists trg_sync_medicamento_items on public.surveys;
--   drop function if exists public.medd_sync_medicamento_items();
--   drop table if exists public.medicamento_item;
-- =====================================================================

create table if not exists public.medicamento_item (
  id                bigint generated always as identity primary key,
  survey_id         uuid not null references public.surveys(id) on delete cascade,
  idx               int  not null,                 -- posición en el inventario (0..n)
  nombre_comercial  text,
  principio_activo  text,
  concentracion     numeric,
  unidad            text,
  fecha_vencimiento date,
  fuente_obtencion  text,                          -- RBQM R8, por medicamento
  atc_codigo        text,                          -- reservado; NULL hasta fuente trazable
  unique (survey_id, idx)
);

create index if not exists idx_medicamento_item_survey on public.medicamento_item(survey_id);
create index if not exists idx_medicamento_item_dci    on public.medicamento_item(principio_activo);

-- ─── RLS: hereda la visibilidad de la encuesta madre ────────────────────────
-- SELECT visible solo si la encuesta padre es visible bajo la RLS de surveys
-- (el subquery se evalúa con la RLS del usuario, así que hereda piloto/prod/rol).
alter table public.medicamento_item enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'medicamento_item' and policyname = 'medicamento_item_select') then
    create policy medicamento_item_select on public.medicamento_item
      for select to authenticated
      using (exists (select 1 from public.surveys s where s.id = survey_id));
  end if;
end $$;

-- ─── Materialización: explota surveys.medications (jsonb) → filas tipadas ────
create or replace function public.medd_sync_medicamento_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.medicamento_item where survey_id = new.id;
  insert into public.medicamento_item
    (survey_id, idx, nombre_comercial, principio_activo, concentracion, unidad, fecha_vencimiento, fuente_obtencion)
  select new.id,
         (ord - 1)::int,
         nullif(m->>'nmMed', ''),
         nullif(m->>'dci', ''),
         nullif(m->>'concMed', '')::numeric,
         nullif(m->>'undConc', ''),
         nullif(m->>'fVto', '')::date,
         nullif(m->>'fuenteObtencion', '')
  from jsonb_array_elements(coalesce(new.medications, '[]'::jsonb)) with ordinality as t(m, ord);
  return new;
end $$;

drop trigger if exists trg_sync_medicamento_items on public.surveys;
create trigger trg_sync_medicamento_items
  after insert or update of medications on public.surveys
  for each row execute function public.medd_sync_medicamento_items();

-- ─── Back-fill idempotente de los históricos ya presentes ───────────────────
-- Solo encuestas aún no explotadas (re-ejecutar no duplica).
insert into public.medicamento_item
  (survey_id, idx, nombre_comercial, principio_activo, concentracion, unidad, fecha_vencimiento, fuente_obtencion)
select s.id,
       (ord - 1)::int,
       nullif(m->>'nmMed', ''),
       nullif(m->>'dci', ''),
       nullif(m->>'concMed', '')::numeric,
       nullif(m->>'undConc', ''),
       nullif(m->>'fVto', '')::date,
       nullif(m->>'fuenteObtencion', '')
from public.surveys s
cross join lateral jsonb_array_elements(coalesce(s.medications, '[]'::jsonb)) with ordinality as t(m, ord)
where not exists (select 1 from public.medicamento_item mi where mi.survey_id = s.id);

-- ─── Vista: estado de vencimiento por ítem contra la fecha de encuesta ──────
create or replace view public.v_medicamento_estado
  with (security_invoker = true) as
select mi.id,
       mi.survey_id,
       mi.idx,
       mi.nombre_comercial,
       mi.principio_activo,
       mi.concentracion,
       mi.unidad,
       mi.fecha_vencimiento,
       mi.fuente_obtencion,
       mi.atc_codigo,
       s.f_eta as fecha_encuesta,
       case
         when mi.fecha_vencimiento is null       then 'sin_fecha'
         when mi.fecha_vencimiento <  s.f_eta     then 'vencido'
         when mi.fecha_vencimiento <= s.f_eta + interval '180 days' then 'vence_6m'
         else 'vigente'
       end as estado_vencimiento
from public.medicamento_item mi
join public.surveys s on s.id = mi.survey_id;

comment on table public.medicamento_item is
  'Inventario normalizado (RBQM R5): una fila por medicamento, materializada por trigger desde surveys.medications (jsonb). Fuente de verdad para el análisis por producto (clase, vencimiento, fuente de obtención).';
comment on view public.v_medicamento_estado is
  'Estado de vencimiento por medicamento contra la fecha de encuesta: sin_fecha | vencido | vence_6m (≤180 d) | vigente.';
