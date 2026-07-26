-- =====================================================================
-- MEDD-App — 027 Invariante del margen de caducidad con signo (Sección 11, Cambio 3)
--
-- Contexto metodológico: el margen de caducidad (fecha_vencimiento − fecha_encuesta)
-- tiene soporte en negativos y positivos — los ítems ya vencidos al momento de la
-- encuesta tienen margen NEGATIVO. Los modelos correctos para esa variable (regresión
-- cuantílica de la mediana como primaria; MCO con varianza robusta por conglomerado
-- como sensibilidad) operan sobre el soporte completo y exigen el valor CRUDO CON
-- SIGNO. Forzar positividad por desplazamiento de constante queda descartado por
-- diseño (destruye la interpretabilidad de las razones marginales, viola QbD).
--
-- Qué hace: añade a la vista `v_medicamento_estado` la columna continua
-- `margen_dias = fecha_vencimiento − fecha_encuesta` (días, con signo), SIN truncar
-- en cero, SIN filtrar los vencidos y SIN desplazamiento. La categoría descriptiva
-- `estado_vencimiento` se conserva como columna aparte (no la reemplaza).
--
-- No añade captura: es una restricción sobre cómo se DERIVA y EXPONE un dato ya
-- capturado (fecha_vencimiento de 023, f_eta de la encuesta).
--
-- ⚠️ ORDEN DE COLUMNAS: `create or replace view` NO puede reordenar/renombrar las
-- columnas existentes de la vista 023, solo AÑADIR al final. Por eso `margen_dias`
-- se anexa como ÚLTIMA columna, tras `estado_vencimiento` (misma lección que la
-- corrección de la migración 019).
--
-- Idempotente: create or replace. Rollback: re-crear la vista sin `margen_dias`
-- (ver 023) — o `create or replace view ... ` con la definición previa.
-- =====================================================================

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
       end as estado_vencimiento,
       -- Cambio 3: margen CONTINUO con signo (última columna, no reordena la vista).
       -- NULL si falta fecha_vencimiento; negativo si ya estaba vencido (incluido, no
       -- excluido; no truncado; sin desplazamiento).
       (mi.fecha_vencimiento - s.f_eta) as margen_dias
from public.medicamento_item mi
join public.surveys s on s.id = mi.survey_id;

comment on view public.v_medicamento_estado is
  'Estado de vencimiento por medicamento contra la fecha de encuesta (sin_fecha | vencido | vence_6m (<=180 d) | vigente) MÁS el margen continuo con signo margen_dias (fecha_vencimiento − fecha_encuesta; negativo = ya vencido; sin truncar ni excluir vencidos) para el análisis del margen (Sección 11.2).';
