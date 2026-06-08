-- =====================================================================
-- MEDD-App — Perfil del encuestador, sincronizado a la cuenta
--
-- El perfil (ID + programa + tipo de institución + semestre + institución)
-- se estampa en CADA encuesta capturada. Antes vivía solo en el dispositivo
-- (IndexedDB), de modo que un perfil incompleto degradaba silenciosamente la
-- calidad de los datos y no viajaba entre dispositivos. Esta tabla lo persiste
-- por usuario para poder: (a) exigir su compleción, y (b) recuperarlo al
-- iniciar sesión en cualquier dispositivo.
-- =====================================================================

create table if not exists public.user_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  nui_encuestador text,
  etr_programa    text,
  etr_tipo_inst   text,
  etr_semestre    int,
  etr_institucion text,
  updated_at      timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Cada usuario sólo puede leer y escribir su propio perfil. Sin política para
-- otros roles: un investigador no necesita (ni debe) ver perfiles ajenos aquí.
drop policy if exists "profile_select_own" on public.user_profiles;
create policy "profile_select_own"
  on public.user_profiles for select
  using ((select auth.uid()) = user_id);

drop policy if exists "profile_insert_own" on public.user_profiles;
create policy "profile_insert_own"
  on public.user_profiles for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "profile_update_own" on public.user_profiles;
create policy "profile_update_own"
  on public.user_profiles for update
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
