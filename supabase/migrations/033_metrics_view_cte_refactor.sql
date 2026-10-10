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
