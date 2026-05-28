-- =====================================================================
-- MEDD-App — Supabase Schema
-- Offline-first: surveys stored as single rows with medications JSONB.
-- Each survey UUID matches the IDB primary key for idempotent upserts.
-- =====================================================================

-- Geographic analysis support
create extension if not exists postgis with schema extensions;

-- ─── SURVEYS ─────────────────────────────────────────────────────────
create table if not exists public.surveys (
  id            uuid        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null,
  updated_at    timestamptz not null,

  -- Step 1: Identificación
  f_eta         date,
  nui_etr       integer,
  nui           integer     not null,

  -- Step 2: Demografía
  f_nac         date,
  ciudad        text,
  dir           text,
  estrato       smallint,
  etnia         text,
  as_salud      text,
  est_lab       text,
  ingreso       text,
  nv_estu       text,

  -- Step 3: Salud (valores 'Sí'|'No'|'' almacenados como text)
  per_salud     text,
  est_salud     text,
  prb_salud     text,
  con_med       text,
  med_prc       text,
  f_prc         date,
  f_disp        date,
  ind_med       text,

  -- Step 4: Almacenamiento
  med_sob       text,
  disp_med_vc   text,
  cto_disp_vc   text,
  vto_med_nc    text,
  cant_med      integer,
  cant_med_vto  integer,
  peso_med_nc   numeric(12,2),

  -- Step 5: Medicamentos (JSONB para sync atómico sin joins)
  medications   jsonb       not null default '[]'::jsonb,

  -- Step 6: Notas
  obs           text,

  constraint chk_estrato check (estrato is null or estrato between 1 and 6),
  constraint chk_cant_med check (cant_med is null or cant_med >= 0),
  constraint chk_cant_vto check (cant_med_vto is null or cant_med_vto >= 0),
  constraint chk_peso     check (peso_med_nc is null or peso_med_nc >= 0)
);

-- Índices para análisis geográfico / analítico
create index if not exists idx_surveys_user_id on public.surveys(user_id);
create index if not exists idx_surveys_ciudad  on public.surveys(ciudad);
create index if not exists idx_surveys_estrato on public.surveys(estrato);
create index if not exists idx_surveys_f_eta   on public.surveys(f_eta);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────
alter table public.surveys enable row level security;

create policy "Usuarios gestionan sus propias encuestas"
  on public.surveys
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── VISTA ANALÍTICA ─────────────────────────────────────────────────
-- Métricas por medicamento con contexto sociogeográfico.
-- T_VTO  = F_ETA - F_VTO   (días vencido en hogar)
-- T_DISP = F_ETA - F_DISP  (ciclo total desde dispensación)
-- V_UTIL = F_VTO - F_DISP  (vida útil remanente al dispensar)
create or replace view public.v_product_metrics as
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
  m.value ->> 'nmMed'                          as nm_med,
  m.value ->> 'dci'                             as dci,
  (m.value ->> 'concMed')::numeric              as conc_med,
  m.value ->> 'undConc'                         as und_conc,
  (m.value ->> 'fVto')::date                    as f_vto,
  ((m.value ->> 'fVto')::date < s.f_eta)        as is_expired,
  case when (m.value ->> 'fVto') is not null
       then (s.f_eta - (m.value ->> 'fVto')::date) end as t_vto,
  case when s.f_disp is not null
       then (s.f_eta - s.f_disp)               end as t_disp,
  case when (m.value ->> 'fVto') is not null and s.f_disp is not null
       then ((m.value ->> 'fVto')::date - s.f_disp) end as v_util
from public.surveys s,
     jsonb_array_elements(s.medications) as m;
