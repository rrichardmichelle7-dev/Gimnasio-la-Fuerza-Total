-- Kilvio FIT - Hardening SaaS Supabase/PostgreSQL
-- Ejecutar en Supabase SQL Editor con un rol administrador.
-- Objetivo: roles validos, multi-gimnasio con RLS, auditoria, caja segura y soporte de usuarios.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- 1) Roles permitidos. El rol entrenador queda migrado a recepcion y bloqueado.
-- super_admin_saas queda reservado para el backend administrativo Michel Soft.
update public.perfiles
set rol = 'recepcion'
where lower(coalesce(rol, '')) = 'entrenador';

alter table public.perfiles
  drop constraint if exists perfiles_rol_check;

alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('administrador', 'recepcion', 'super_admin_saas'));

alter table public.perfiles
  drop constraint if exists perfiles_estado_check;

alter table public.perfiles
  add constraint perfiles_estado_check
  check (estado in ('activo', 'inactivo'));

create or replace function app_private.current_profile()
returns table (
  user_id uuid,
  gimnasio_id uuid,
  rol text,
  estado text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.user_id, p.gimnasio_id, p.rol, p.estado
  from public.perfiles p
  where p.user_id = (select auth.uid())
    and lower(coalesce(p.estado, '')) = 'activo'
  limit 1;
$$;

create or replace function app_private.current_gimnasio_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.gimnasio_id
  from public.perfiles p
  where p.user_id = (select auth.uid())
    and lower(coalesce(p.estado, '')) = 'activo'
  limit 1;
$$;

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

revoke all on function app_private.current_profile() from public;
revoke all on function app_private.current_gimnasio_id() from public;
revoke all on function app_private.is_admin() from public;
grant execute on function app_private.current_profile() to authenticated;
grant execute on function app_private.current_gimnasio_id() to authenticated;
grant execute on function app_private.is_admin() to authenticated;

-- 2) Auditoria.
create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null,
  usuario_id uuid,
  usuario_email text,
  accion text not null,
  modulo text not null,
  datos_modificados jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_eventos_gimnasio_created_idx
  on public.auditoria_eventos (gimnasio_id, created_at desc);

alter table public.auditoria_eventos enable row level security;
grant select, insert on public.auditoria_eventos to authenticated;

drop policy if exists "auditoria_insert_gimnasio_activo" on public.auditoria_eventos;
drop policy if exists "auditoria_select_admin_gimnasio" on public.auditoria_eventos;

create policy "auditoria_insert_gimnasio_activo"
on public.auditoria_eventos
for insert
to authenticated
with check (
  gimnasio_id = app_private.current_gimnasio_id()
  and usuario_id = (select auth.uid())
);

create policy "auditoria_select_admin_gimnasio"
on public.auditoria_eventos
for select
to authenticated
using (
  app_private.is_admin()
  and gimnasio_id = app_private.current_gimnasio_id()
);

-- 3) RLS base para tablas con gimnasio_id.
-- Ajusta esta lista si en tu proyecto agregas nuevas tablas publicas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'Miembros',
    'pagos',
    'productos',
    'asistencias',
    'ingresos_diarios',
    'proveedores',
    'compras_proveedores',
    'ventas',
    'venta_detalles',
    'movimientos_inventario',
    'facturas',
    'cajas_turno',
    'configuracion_mensualidad'
  ]
  loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end $$;

-- Miembros
drop policy if exists "miembros_select_gimnasio" on public."Miembros";
drop policy if exists "miembros_insert_gimnasio" on public."Miembros";
drop policy if exists "miembros_update_gimnasio" on public."Miembros";
create policy "miembros_select_gimnasio" on public."Miembros"
for select to authenticated
using (gimnasio_id = app_private.current_gimnasio_id());
create policy "miembros_insert_gimnasio" on public."Miembros"
for insert to authenticated
with check (gimnasio_id = app_private.current_gimnasio_id());
create policy "miembros_update_gimnasio" on public."Miembros"
for update to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

-- Pagos y operaciones de caja/venta. Recepcion puede operar; administrador tambien.
drop policy if exists "pagos_crud_gimnasio" on public.pagos;
create policy "pagos_crud_gimnasio" on public.pagos
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "productos_crud_gimnasio" on public.productos;
create policy "productos_crud_gimnasio" on public.productos
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "asistencias_crud_gimnasio" on public.asistencias;
create policy "asistencias_crud_gimnasio" on public.asistencias
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "ingresos_diarios_crud_gimnasio" on public.ingresos_diarios;
create policy "ingresos_diarios_crud_gimnasio" on public.ingresos_diarios
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "ventas_crud_gimnasio" on public.ventas;
create policy "ventas_crud_gimnasio" on public.ventas
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "venta_detalles_crud_gimnasio" on public.venta_detalles;
create policy "venta_detalles_crud_gimnasio" on public.venta_detalles
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "facturas_crud_gimnasio" on public.facturas;
create policy "facturas_crud_gimnasio" on public.facturas
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "cajas_turno_crud_gimnasio" on public.cajas_turno;
create policy "cajas_turno_crud_gimnasio" on public.cajas_turno
for all to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

-- Configuracion, proveedores, compras y movimientos: solo administrador del gimnasio.
drop policy if exists "configuracion_admin_gimnasio" on public.configuracion_mensualidad;
create policy "configuracion_admin_gimnasio" on public.configuracion_mensualidad
for all to authenticated
using (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id())
with check (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "proveedores_admin_gimnasio" on public.proveedores;
create policy "proveedores_admin_gimnasio" on public.proveedores
for all to authenticated
using (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id())
with check (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "compras_admin_gimnasio" on public.compras_proveedores;
create policy "compras_admin_gimnasio" on public.compras_proveedores
for all to authenticated
using (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id())
with check (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "movimientos_select_gimnasio" on public.movimientos_inventario;
create policy "movimientos_select_gimnasio" on public.movimientos_inventario
for select to authenticated
using (gimnasio_id = app_private.current_gimnasio_id());

-- 4) Perfiles y solicitudes.
alter table public.perfiles enable row level security;
grant select, insert, update on public.perfiles to authenticated;

drop policy if exists "perfiles_select_self_or_admin_gym" on public.perfiles;
drop policy if exists "perfiles_insert_admin_gym" on public.perfiles;
drop policy if exists "perfiles_update_admin_gym" on public.perfiles;

create policy "perfiles_select_self_or_admin_gym"
on public.perfiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id())
);

create policy "perfiles_insert_admin_gym"
on public.perfiles
for insert to authenticated
with check (
  app_private.is_admin()
  and gimnasio_id = app_private.current_gimnasio_id()
  and rol in ('administrador', 'recepcion')
);

create policy "perfiles_update_admin_gym"
on public.perfiles
for update to authenticated
using (app_private.is_admin() and gimnasio_id = app_private.current_gimnasio_id())
with check (
  app_private.is_admin()
  and gimnasio_id = app_private.current_gimnasio_id()
  and rol in ('administrador', 'recepcion')
);

alter table public.solicitudes_acceso enable row level security;
grant select, insert, update on public.solicitudes_acceso to authenticated;

drop policy if exists "solicitudes_insert_self" on public.solicitudes_acceso;
drop policy if exists "solicitudes_select_self_or_admin" on public.solicitudes_acceso;
drop policy if exists "solicitudes_update_self_pending" on public.solicitudes_acceso;
drop policy if exists "solicitudes_update_admin" on public.solicitudes_acceso;

create policy "solicitudes_insert_self" on public.solicitudes_acceso
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "solicitudes_select_self_or_admin" on public.solicitudes_acceso
for select to authenticated
using (user_id = (select auth.uid()) or app_private.is_admin());

create policy "solicitudes_update_self_pending" on public.solicitudes_acceso
for update to authenticated
using (user_id = (select auth.uid()) and estado = 'pendiente')
with check (user_id = (select auth.uid()) and estado = 'pendiente');

create policy "solicitudes_update_admin" on public.solicitudes_acceso
for update to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

-- 5) Caja: una caja abierta por usuario y gimnasio.
create unique index if not exists cajas_turno_unica_abierta_usuario_idx
on public.cajas_turno (gimnasio_id, usuario_id)
where estado = 'abierta';

create index if not exists cajas_turno_gimnasio_created_idx
on public.cajas_turno (gimnasio_id, created_at desc);

-- 6) Storage productos: rutas deben iniciar con el gimnasio_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 2097152, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_productos_upload_gimnasio" on storage.objects;
drop policy if exists "storage_productos_read" on storage.objects;

create policy "storage_productos_upload_gimnasio"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'productos'
  and split_part(name, '/', 1) = app_private.current_gimnasio_id()::text
);

create policy "storage_productos_read"
on storage.objects
for select to authenticated
using (
  bucket_id = 'productos'
  and split_part(name, '/', 1) = app_private.current_gimnasio_id()::text
);

notify pgrst, 'reload schema';
