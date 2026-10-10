-- =====================================================================
-- MEDD-App — 019 Exponer clúster, versión y geografía en v_product_metrics
--
-- Contexto (auditoría del piloto, Sec. 7 Rec. 5 y 6):
--   El objetivo de `hogar_id` (016/018) y de `instrument_version` (013/017) es
--   hacer MODELABLE el agrupamiento (ICC≈0,27) y separar denominadores por
--   versión. Pero la vista analítica server-side `v_product_metrics` —la que usa
--   el rol investigador— aún NO exponía esas columnas, así que el clúster de
--   hogar/encuestador y la versión no eran identificables desde SQL.
--
--   Esta migración recrea la vista (definición idéntica a 004 + hardening) y
--   AÑADE columnas al FINAL:
--     * nui_etr           → clúster de encuestador (efecto-encuestador)
--     * hogar_id           → clúster de hogar (ICC por hogar)
--     * metodo_seleccion   → diseño muestral
--     * instrument_version → para acotar denominadores por versión
--     * departamento       → geografía DANE (además de ciudad)
--
-- ⚠️ ORDEN DE COLUMNAS: `create or replace view` NO puede renombrar ni reordenar
-- las columnas existentes de una vista ya creada — solo permite AÑADIR columnas
-- nuevas AL FINAL. Por eso las 19 columnas originales (004) se mantienen en su
-- posición y nombre exactos, y las 5 nuevas se anexan después. (No usar `drop
-- view` para no arrastrar dependencias/permisos.)
--
-- Puramente aditiva: los consumidores existentes que seleccionan columnas por
-- nombre no se ven afectados. SECURITY INVOKER se preserva (la RLS de surveys
-- sigue aplicando por usuario que consulta). Idempotente (create or replace).
--
-- Rollback: re-aplicar 004_harden_metrics_view.sql (recrea la vista sin las
-- columnas añadidas — al ser una reducción de columnas requiere primero
-- `drop view if exists public.v_product_metrics;`). No hay pérdida de datos.
-- =====================================================================

create or replace view public.v_product_metrics
  with (security_invoker = true)
as
with parsed_meds as (
  select
    s.id          as survey_id,
    s.user_id,
    s.f_eta,
    s.ciudad,
    s.estrato,
    s.as_salud,
    s.cant_med,
    s.cant_med_vto,
    s.peso_med_nc,
    s.f_disp,
    m.value ->> 'nmMed'                                  as nm_med,
    m.value ->> 'dci'                                    as dci,
    nullif(trim(m.value ->> 'concMed'), '')::numeric           as conc_med,
    m.value ->> 'undConc'                                as und_conc,
    nullif(trim(m.value ->> 'fVto'), '')::date                 as f_vto,
    s.nui_etr,
    s.hogar_id,
    s.metodo_seleccion,
    s.instrument_version,
    s.departamento
  from public.surveys s,
       jsonb_array_elements(s.medications) as m
)
select
  -- ── Columnas originales (004), en su orden y nombre exactos ──
  survey_id,
  user_id,
  f_eta,
  ciudad,
  estrato,
  as_salud,
  cant_med,
  cant_med_vto,
  peso_med_nc,
  f_disp,
  nm_med,
  dci,
  conc_med,
  und_conc,
  f_vto,
  case when f_vto is not null
       then (f_vto < f_eta)
  end                                                   as is_expired,
  case when f_vto is not null
       then (f_eta - f_vto)
  end                                                   as t_vto,    -- días vencido en hogar
  case when f_disp is not null
       then (f_eta - f_disp)
  end                                                   as t_disp,   -- ciclo total desde dispensación
  case when f_vto is not null and f_disp is not null
       then (f_vto - f_disp)
  end                                                   as v_util,   -- vida útil remanente al dispensar
  -- ── Columnas AÑADIDAS al final (auditoría Rec. 5·6) ──
  nui_etr,                                            -- clúster de encuestador
  hogar_id,                                           -- clúster de hogar (ICC)
  metodo_seleccion,                                   -- diseño muestral
  instrument_version,                                 -- denominadores por versión
  departamento                                        -- geografía DANE
from parsed_meds;
