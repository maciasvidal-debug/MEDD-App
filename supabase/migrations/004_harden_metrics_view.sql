-- =====================================================================
-- 004 — Harden the per-product analytics view (v_product_metrics)
--
-- The medications array stored in surveys.medications (JSONB) can carry an
-- empty string for an optional expiry date (fVto: "") or concentration
-- (concMed: ""), because the wizard treats both as optional. The previous
-- view cast those values directly:
--     (m.value ->> 'fVto')::date
-- and the `IS NOT NULL` guard does NOT catch '' — so a single medication
-- without an expiry date raised `invalid input syntax for type date: ""`
-- and aborted EVERY aggregate query built on the view (summary, risk, etc.).
--
-- Fix: route each optional cast through NULLIF(<text>, '') so an empty string
-- collapses to SQL NULL instead of crashing the cast. is_expired is also moved
-- inside a guard so it stays NULL (unknown) when there is no expiry date,
-- rather than depending on a cast that could fail.
--
-- Pure hardening: for any record that already had a valid date/number the
-- output is unchanged, so existing analytics are bit-for-bit identical.
-- SECURITY INVOKER is preserved so RLS keeps applying per querying user.
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
    nullif(m.value ->> 'concMed', '')::numeric           as conc_med,
    m.value ->> 'undConc'                                as und_conc,
    nullif(m.value ->> 'fVto', '')::date                 as f_vto
  from public.surveys s,
       jsonb_array_elements(s.medications) as m
)
select
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
  end                                                   as v_util    -- vida útil remanente al dispensar
from parsed_meds;
