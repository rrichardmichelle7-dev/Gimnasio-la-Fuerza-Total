-- Autorizacion de usuarios con Google para Kilvio FIT.
-- Ejecutar en Supabase SQL Editor con un rol administrador de base de datos.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.solicitudes_acceso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  nombre_google text,
  estado text default 'pendiente',
  rol_solicitado text,
  aprobado_por uuid,
  aprobado_at timestamptz,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'solicitudes_acceso_user_id_key'
      and conrelid = 'public.solicitudes_acceso'::regclass
  ) then
    alter table public.solicitudes_acceso
      add constraint solicitudes_acceso_user_id_key unique (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'solicitudes_acceso_estado_check'
      and conrelid = 'public.solicitudes_acceso'::regclass
  ) then
    alter table public.solicitudes_acceso
      add constraint solicitudes_acceso_estado_check
      check (estado in ('pendiente', 'aprobada', 'rechazada'));
  end if;
end $$;

create index if not exists solicitudes_acceso_estado_created_at_idx
  on public.solicitudes_acceso (estado, created_at desc);

create or replace function app_private.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = (select auth.uid())
      and p.rol = 'administrador'
      and lower(coalesce(p.estado, '')) = 'activo'
  );
$$;

create or replace function app_private.current_admin_gimnasio_id()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.gimnasio_id::text
  from public.perfiles p
  where p.user_id = (select auth.uid())
    and p.rol = 'administrador'
    and lower(coalesce(p.estado, '')) = 'activo'
  limit 1;
$$;

revoke all on function app_private.is_admin() from public;
revoke all on function app_private.current_admin_gimnasio_id() from public;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.current_admin_gimnasio_id() to authenticated;

alter table public.solicitudes_acceso enable row level security;

grant select, insert, update on public.solicitudes_acceso to authenticated;

drop policy if exists "solicitudes_acceso_insertar_propia" on public.solicitudes_acceso;
drop policy if exists "solicitudes_acceso_ver_propia_o_admin" on public.solicitudes_acceso;
drop policy if exists "solicitudes_acceso_actualizar_propia_pendiente" on public.solicitudes_acceso;
drop policy if exists "solicitudes_acceso_actualizar_admin" on public.solicitudes_acceso;

create policy "solicitudes_acceso_insertar_propia"
on public.solicitudes_acceso
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "solicitudes_acceso_ver_propia_o_admin"
on public.solicitudes_acceso
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or app_private.is_admin()
);

create policy "solicitudes_acceso_actualizar_propia_pendiente"
on public.solicitudes_acceso
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and estado = 'pendiente'
  and aprobado_por is null
  and aprobado_at is null
);

create policy "solicitudes_acceso_actualizar_admin"
on public.solicitudes_acceso
for update
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

-- Policies necesarias para que el administrador autorice perfiles desde el frontend.
-- No reemplazan policies existentes; solo agregan permisos al administrador activo.

grant select, insert, update on public.perfiles to authenticated;

drop policy if exists "perfiles_admin_ver_gimnasio" on public.perfiles;
drop policy if exists "perfiles_admin_insertar_autorizados" on public.perfiles;
drop policy if exists "perfiles_insert_admin_gimnasio" on public.perfiles;
drop policy if exists "perfiles_admin_actualizar_gimnasio" on public.perfiles;

create policy "perfiles_admin_ver_gimnasio"
on public.perfiles
for select
to authenticated
using (
  app_private.is_admin()
  and gimnasio_id::text = app_private.current_admin_gimnasio_id()
);

create policy "perfiles_insert_admin_gimnasio"
on public.perfiles
for insert
to authenticated
with check (
  app_private.is_admin()
  and gimnasio_id::text = app_private.current_admin_gimnasio_id()
);

create policy "perfiles_admin_actualizar_gimnasio"
on public.perfiles
for update
to authenticated
using (
  app_private.is_admin()
  and gimnasio_id::text = app_private.current_admin_gimnasio_id()
)
with check (
  app_private.is_admin()
  and gimnasio_id::text = app_private.current_admin_gimnasio_id()
);

notify pgrst, 'reload schema';
