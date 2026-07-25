-- =====================================================================
-- MEDD-App — 025 Vistas de monitoreo de QTL (RBQM · Plan de control Paso 3)
--
-- Operacionaliza los límites de tolerancia de calidad (QTL) del registro de
-- riesgos como vistas consultables, para vigilar la calidad EN CAMPO desde el
-- primer registro de la próxima ola. El monitoreo se concentra en lo crítico
-- (R1, R2, R3) y cubre el resto por excepción. Todas son security_invoker
-- (heredan la RLS de surveys → rol investigador). Se filtran a data_env='prod'.
--
-- v_qtl_dashboard resume una fila por QTL con valor, umbral y en_alarma, para la
-- revisión diaria de la ola. Idempotente (create or replace). Rollback:
--   drop view if exists public.v_qtl_dashboard, public.v_qtl_r1_version,
--     public.v_qtl_r2_duracion_encuestador, public.v_qtl_r3_disposicion,
--     public.v_qtl_r5_items_sin_vto, public.v_qtl_r7_rango cascade;
-- =====================================================================

-- R1 — Versión: 0% nulas (defecto dominante del piloto).
create or replace view public.v_qtl_r1_version with (security_invoker = true) as
select count(*)                                                as n,
       count(*) filter (where instrument_version is null)     as n_version_nula,
       round(100.0 * count(*) filter (where instrument_version is null)
             / nullif(count(*), 0), 2)                        as pct_nula
from public.surveys where data_env = 'prod';

-- R2 — Fidelidad de la medición: mediana de duración por encuestador vs. global.
-- Alarma operativa (interpretación del investigador): encuestador con mediana muy
-- por debajo de la global señala entrevistas apresuradas (regla de parada: el
-- umbral exacto es criterio del investigador; ver 02-control-plan.md).
create or replace view public.v_qtl_r2_duracion_encuestador with (security_invoker = true) as
with d as (
  select nui_etr,
         extract(epoch from (updated_at - started_at)) as dur_s
  from public.surveys
  where data_env = 'prod' and started_at is not null and updated_at is not null
)
select nui_etr,
       count(*)                                                       as n,
       round(percentile_cont(0.5) within group (order by dur_s))      as mediana_s,
       round((select percentile_cont(0.5) within group (order by dur_s) from d)) as mediana_global_s
from d group by nui_etr;

-- R3 — Completitud del bloque de disposición ≥ 95% (cuando aplica: medSob='Sí').
create or replace view public.v_qtl_r3_disposicion with (security_invoker = true) as
select count(*)                                                          as n_aplica,
       count(*) filter (where disp_med_vc is not null and vto_med_nc is not null) as n_completo,
       round(100.0 * count(*) filter (where disp_med_vc is not null and vto_med_nc is not null)
             / nullif(count(*), 0), 2)                                   as pct_completo
from public.surveys
where data_env = 'prod' and med_sob = 'Sí' and instrument_version >= 2;

-- R5 — Inventario: % de ítems sin fecha de vencimiento (usa la tabla hija 023).
create or replace view public.v_qtl_r5_items_sin_vto with (security_invoker = true) as
select count(*)                                              as n_items,
       count(*) filter (where mi.fecha_vencimiento is null) as n_sin_vto,
       round(100.0 * count(*) filter (where mi.fecha_vencimiento is null)
             / nullif(count(*), 0), 2)                       as pct_sin_vto
from public.medicamento_item mi
join public.surveys s on s.id = mi.survey_id
where s.data_env = 'prod';

-- R7 — Rango: conteos fuera de rango (deberían ser 0; la base ya los rechaza en
-- captura nueva, esta vista vigila el dato en reposo, incluidos históricos).
create or replace view public.v_qtl_r7_rango with (security_invoker = true) as
select
  count(*) filter (where f_eta > current_date)                                       as fecha_futura,
  count(*) filter (where f_eta < date '2024-01-01')                                  as fecha_previa_estudio,
  count(*) filter (where f_nac is not null and f_eta is not null and f_nac > f_eta)   as nac_posterior_entrevista,
  count(*) filter (where f_nac is not null and f_eta is not null
                     and (f_eta - f_nac) not between 0 and 40177)                     as edad_implausible,
  count(*) filter (where peso_med_nc is not null and peso_med_nc < 0)                 as peso_negativo
from public.surveys where data_env = 'prod';

-- Tablero: una fila por QTL con valor, umbral y bandera de alarma.
create or replace view public.v_qtl_dashboard with (security_invoker = true) as
select 'R1' as qtl, 'Versión nula (%)'            as metrica, coalesce(pct_nula, 0)        as valor, 0::numeric  as umbral, coalesce(pct_nula,0)      > 0   as en_alarma from public.v_qtl_r1_version
union all
select 'R3', 'Completitud disposición (%)',      coalesce(pct_completo, 100), 95::numeric, coalesce(pct_completo,100) < 95  from public.v_qtl_r3_disposicion
union all
select 'R5', 'Ítems sin vencimiento (%)',        coalesce(pct_sin_vto, 0),    20::numeric, coalesce(pct_sin_vto,0)    > 20  from public.v_qtl_r5_items_sin_vto
union all
select 'R7', 'Registros fuera de rango (n)',
       (select (fecha_futura + fecha_previa_estudio + nac_posterior_entrevista + edad_implausible + peso_negativo)::numeric from public.v_qtl_r7_rango),
       0::numeric,
       (select (fecha_futura + fecha_previa_estudio + nac_posterior_entrevista + edad_implausible + peso_negativo) from public.v_qtl_r7_rango) > 0;

comment on view public.v_qtl_dashboard is
  'Tablero RBQM: una fila por QTL (R1/R3/R5/R7) con valor, umbral y en_alarma. R2 (duración por encuestador) en v_qtl_r2_duracion_encuestador — umbral por criterio del investigador. Revisión diaria durante la ola.';
