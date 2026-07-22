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
select
  -- ── Columnas originales (004), en su orden y nombre exactos ──
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
  m.value ->> 'nmMed'                                   as nm_med,
  m.value ->> 'dci'                                     as dci,
  nullif(m.value ->> 'concMed', '')::numeric           as conc_med,
  m.value ->> 'undConc'                                 as und_conc,
  nullif(m.value ->> 'fVto', '')::date                  as f_vto,
  case when nullif(m.value ->> 'fVto', '') is not null
       then (nullif(m.value ->> 'fVto', '')::date < s.f_eta)
  end                                                   as is_expired,
  case when nullif(m.value ->> 'fVto', '') is not null
       then (s.f_eta - nullif(m.value ->> 'fVto', '')::date)
  end                                                   as t_vto,    -- días vencido en hogar
  case when s.f_disp is not null
       then (s.f_eta - s.f_disp)
  end                                                   as t_disp,   -- ciclo total desde dispensación
  case when nullif(m.value ->> 'fVto', '') is not null and s.f_disp is not null
       then (nullif(m.value ->> 'fVto', '')::date - s.f_disp)
  end                                                   as v_util,   -- vida útil remanente al dispensar
  -- ── Columnas AÑADIDAS al final (auditoría Rec. 5·6) ──
  s.nui_etr,                                            -- clúster de encuestador
  s.hogar_id,                                           -- clúster de hogar (ICC)
  s.metodo_seleccion,                                   -- diseño muestral
  s.instrument_version,                                 -- denominadores por versión
  s.departamento                                        -- geografía DANE
from public.surveys s,
     jsonb_array_elements(s.medications) as m;
