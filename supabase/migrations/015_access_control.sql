-- =====================================================================
-- MEDD-App — Control de acceso: aprobación de cuentas (defensa en profundidad)
--
-- Contexto:
--   El registro público estaba abierto: cualquiera con la URL podía crear
--   una cuenta (rol 'encuestador' por trigger) e inyectar encuestas al
--   Postgres compartido, contaminando la procedencia de los datos del
--   estudio. Aunque la RLS aísla por usuario, el investigador ve el
--   agregado de TODAS las encuestas.
--
-- Modelo operativo (coordinador provisiona):
--   1. Desactivar el registro público en el dashboard de Supabase:
--        Authentication → Providers/Sign In → "Allow new users to sign up" = OFF
--      (o vía Management API: Auth settings, DISABLE_SIGNUP = true).
--      La app además oculta la pestaña «Registrarse».
--   2. El coordinador crea cada cuenta en Authentication → Users → Add user
--      (email + contraseña temporal) y activa el acceso:
--        UPDATE public.user_roles
--        SET    active = true,           -- habilita captura/sincronización
--               role   = 'encuestador'   -- o 'investigador'
--        WHERE  user_id = '<uuid>';
--
-- Esta migración es la garantía en el servidor: aunque una cuenta se cree
-- por cualquier vía, arranca INACTIVA y la RLS le impide escribir datos
-- hasta que el coordinador la active. La app (UI) es solo conveniencia; el
-- control real vive aquí.
-- =====================================================================

-- ─── Columna de estado en user_roles ─────────────────────────────────
-- Guardada: el backfill (activar lo existente) SOLO debe correr al añadir
-- la columna por primera vez. Reaplicar la migración no debe re-activar
-- cuentas que el coordinador haya desactivado luego.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'user_roles'
      and column_name  = 'active'
  ) then
    alter table public.user_roles add column active boolean not null default false;

    -- Las cuentas existentes preceden al control y son de confianza → se
    -- activan para no bloquear a la cohorte actual. Las cuentas nuevas
    -- arrancan inactivas (default false) y requieren activación explícita.
    update public.user_roles set active = true;
  end if;
end $$;

-- ─── Helper: ¿el usuario actual está activo? ─────────────────────────
-- STABLE + SECURITY DEFINER (lee user_roles bypassando RLS; solo consulta
-- la fila del propio usuario). Ausencia de fila o valor nulo → inactivo.
create or replace function public.is_active_member()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select coalesce(
    (select active from public.user_roles where user_id = (select auth.uid())),
    false
  )
$$;

-- ─── RLS endurecida en surveys: solo cuentas activas escriben ─────────
-- SELECT/DELETE se dejan igual (leer o borrar los PROPIOS datos no
-- contamina el dataset compartido). INSERT y UPDATE — los vectores de
-- contaminación — exigen además pertenencia activa.

drop policy if exists "survey_insert" on public.surveys;
create policy "survey_insert"
  on public.surveys for insert
  with check (
    (select auth.uid()) = user_id
    and (select public.is_active_member())
  );

drop policy if exists "survey_update" on public.surveys;
create policy "survey_update"
  on public.surveys for update
  using  ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (select public.is_active_member())
  );

-- Nota: el trigger handle_new_user() (migración 002) sigue insertando la
-- fila de rol; 'active' toma su default (false), así que toda cuenta nueva
-- queda inactiva hasta que el coordinador la active. No requiere cambios.
