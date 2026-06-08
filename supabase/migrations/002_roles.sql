-- =====================================================================
-- MEDD-App — Roles y políticas de acceso basadas en rol
--
-- Roles:
--   encuestador    : accede y gestiona solo sus propias encuestas
--   investigador   : acceso de lectura a todas las encuestas y analítica
--                    agregada. No puede crear encuestas a nombre de otros.
--
-- Asignación de roles:
--   - Todo nuevo usuario recibe 'encuestador' automáticamente (trigger).
--   - Para promover a investigador, actualizar manualmente en el
--     dashboard de Supabase:
--       UPDATE public.user_roles SET role = 'investigador'
--       WHERE user_id = '<uuid>';
-- =====================================================================

-- ─── TIPO ENUM ───────────────────────────────────────────────────────
-- Guarded so re-applying the migration on an existing DB is a no-op
-- (CREATE TYPE has no IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role' and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('encuestador', 'investigador');
  end if;
end $$;

-- ─── TABLA DE ROLES ──────────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     public.app_role not null default 'encuestador',
  assigned_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Cada usuario puede leer su propio rol (necesario para el frontend)
drop policy if exists "user_reads_own_role" on public.user_roles;
create policy "user_reads_own_role"
  on public.user_roles for select
  using ((select auth.uid()) = user_id);

-- ─── FUNCIÓN HELPER ──────────────────────────────────────────────────
-- STABLE: PostgreSQL evalúa una sola vez por query (no por fila).
-- SECURITY DEFINER: lee user_roles bypassando RLS (seguro: solo lee
--   el rol del usuario actual). set search_path = '' evita inyección.
create or replace function public.get_my_role()
returns public.app_role
language sql stable
security definer set search_path = ''
as $$
  select role
  from public.user_roles
  where user_id = (select auth.uid())
$$;

-- ─── TRIGGER: asignar rol encuestador al crear usuario ────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'encuestador');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── POLÍTICAS RLS EN SURVEYS ────────────────────────────────────────
-- Eliminar política anterior (una sola para todo) y reemplazar con
-- políticas separadas por operación para mayor claridad y control.

drop policy if exists "Usuarios gestionan sus propias encuestas" on public.surveys;

-- SELECT: encuestadores ven solo las suyas; investigadores ven todas
drop policy if exists "survey_select" on public.surveys;
create policy "survey_select"
  on public.surveys for select
  using (
    (select auth.uid()) = user_id
    or (select public.get_my_role()) = 'investigador'
  );

-- INSERT: cualquier rol inserta solo sus propias encuestas
drop policy if exists "survey_insert" on public.surveys;
create policy "survey_insert"
  on public.surveys for insert
  with check ((select auth.uid()) = user_id);

-- UPDATE: cada usuario edita solo las suyas
drop policy if exists "survey_update" on public.surveys;
create policy "survey_update"
  on public.surveys for update
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- DELETE: cada usuario elimina solo las suyas
drop policy if exists "survey_delete" on public.surveys;
create policy "survey_delete"
  on public.surveys for delete
  using  ((select auth.uid()) = user_id);
