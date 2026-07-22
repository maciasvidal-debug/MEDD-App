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
--   AÑADE columnas, sin quitar ni cambiar ninguna existente:
--     * nui_etr           → clúster de encuestador (efecto-encuestador)
--     * hogar_id           → clúster de hogar (ICC por hogar)
--     * departamento       → geografía DANE (además de ciudad)
--     * instrument_version → para acotar denominadores por versión
--     * metodo_seleccion   → diseño muestral
--
-- Puramente aditiva: los consumidores existentes que seleccionan columnas por
-- nombre no se ven afectados. SECURITY INVOKER se preserva (la RLS de surveys
-- sigue aplicando por usuario que consulta). Idempotente (create or replace).
--
-- Rollback: re-aplicar 004_harden_metrics_view.sql (recrea la vista sin las
-- columnas añadidas). No hay pérdida de datos: una vista no almacena.
-- =====================================================================

create or replace view public.v_product_metrics
  with (security_invoker = true)
as
select
  s.id          as survey_id,
  s.user_id,
  s.nui_etr,                                            -- clúster de encuestador
  s.hogar_id,                                           -- clúster de hogar
  s.metodo_seleccion,                                   -- diseño muestral
  s.instrument_version,                                 -- versión (denominadores)
  s.f_eta,
  s.ciudad,
  s.departamento,
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
  end                                                   as v_util    -- vida útil remanente al dispensar
from public.surveys s,
     jsonb_array_elements(s.medications) as m;
