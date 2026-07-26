-- =====================================================================
-- MEDD-App — 028 Georreferenciación del hogar (Sección 11, Cambio 2a · R10/R11)
--
-- Objetivo: habilitar el análisis espacial (Moran/LISA, patrón de puntos) de la
-- ola grande y separar el patrón territorial del efecto de encuestador, SIN exponer
-- la ubicación exacta del hogar como PII (Ley 1581).
--
-- Diseño de aislamiento de PII de localización:
--   * `survey_geo` — tabla PROPIA con las coordenadas (lat/lng/exactitud/timestamp),
--     con RLS de SOLO DUEÑO: únicamente el encuestador que capturó la encuesta puede
--     ver/escribir su geo. El rol analítico (investigador) NO tiene acceso → la
--     coordenada cruda nunca llega al panel ni al export analítico (R11).
--   * `surveys.geo_consent` — bandera NO sensible («el hogar autorizó registrar la
--     ubicación»); viaja con la encuesta y es visible para QC de cobertura, sin
--     revelar coordenada alguna.
--   * `v_geo_municipio` — vista analítica AGREGADA a municipio (usa municipio_codigo,
--     ya presente), sin coordenada cruda: la «forma agregada» que basta para el
--     análisis territorial que pide el informe.
--   * El análisis de puntos con coordenada cruda lo ejecuta el responsable del
--     estudio con rol privilegiado (service_role / SQL editor), fuera de la app.
--
-- El código DANE de CENTRO POBLADO (Cambio 2b) queda pendiente del archivo oficial
-- DANE (regla de parada); el GPS + municipio ya habilitan el análisis espacial.
--
-- Idempotente: create table/column if not exists; guardas pg_policies; create or
-- replace view. Rollback:
--   drop view if exists public.v_qtl_geo, public.v_geo_municipio;
--   drop table if exists public.survey_geo;
--   alter table public.surveys drop column if exists geo_consent;
-- =====================================================================

-- Bandera de consentimiento (no sensible) en la encuesta.
alter table public.surveys
  add column if not exists geo_consent boolean not null default false;

comment on column public.surveys.geo_consent is
  'RBQM R11: el hogar autorizó registrar la ubicación GPS (consentimiento explícito). Bandera NO sensible; la coordenada vive aislada en survey_geo.';

-- Tabla aislada de coordenadas (PII de localización).
create table if not exists public.survey_geo (
  survey_id       uuid primary key references public.surveys(id) on delete cascade,
  geo_lat         numeric,
  geo_lng         numeric,
  geo_accuracy_m  numeric,
  geo_captured_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint chk_geo_lat check (geo_lat is null or geo_lat between -90 and 90),
  constraint chk_geo_lng check (geo_lng is null or geo_lng between -180 and 180),
  constraint chk_geo_acc check (geo_accuracy_m is null or geo_accuracy_m >= 0)
);

-- RLS de SOLO DUEÑO: solo el encuestador dueño de la encuesta accede a su geo.
alter table public.survey_geo enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'survey_geo' and policyname = 'survey_geo_owner') then
    create policy survey_geo_owner on public.survey_geo
      for all to authenticated
      using      (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = (select auth.uid())))
      with check (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = (select auth.uid())));
  end if;
end $$;

-- Vista analítica AGREGADA a municipio (sin coordenada cruda). security_invoker →
-- hereda la RLS de surveys (piloto/prod, rol). Habilita el análisis territorial
-- agregado y la cobertura de consentimiento, nunca la ubicación exacta del hogar.
create or replace view public.v_geo_municipio
  with (security_invoker = true) as
select municipio_codigo,
       ciudad,
       departamento,
       count(*)                              as n_encuestas,
       count(*) filter (where geo_consent)   as n_con_consentimiento
from public.surveys
group by municipio_codigo, ciudad, departamento;

comment on view public.v_geo_municipio is
  'Vista analítica territorial AGREGADA a municipio (DANE): conteos por municipio y cobertura de consentimiento GPS. NO expone coordenada cruda del hogar (esa vive aislada en survey_geo con RLS de dueño).';

-- Monitoreo R10 (cobertura de consentimiento + DANE 100%). La presencia de
-- coordenada por consentido se vigila con rol privilegiado sobre survey_geo (fuera
-- del alcance del rol analítico, por diseño de aislamiento).
create or replace view public.v_qtl_geo
  with (security_invoker = true) as
select count(*)                                              as n,
       count(*) filter (where geo_consent)                  as n_consentimiento,
       round(100.0 * count(*) filter (where geo_consent) / nullif(count(*),0), 2) as pct_consentimiento,
       count(*) filter (where municipio_codigo is null)     as n_sin_dane
from public.surveys where data_env = 'prod';

comment on view public.v_qtl_geo is
  'QTL geo (R10): tasa de consentimiento GPS y cobertura DANE de municipio (n_sin_dane debe tender a 0). La coordenada cruda no aparece aquí (aislada por RLS).';
