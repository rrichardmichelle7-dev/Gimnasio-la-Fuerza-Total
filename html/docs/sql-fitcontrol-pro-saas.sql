-- FitControl Pro - estructura SaaS multi-gimnasio para Michel Soft
-- Ejecutar en Supabase SQL Editor con un usuario administrador.
-- Objetivo: separar metadatos SaaS de datos operativos privados del gimnasio.

create schema if not exists app_private;

create table if not exists public.gimnasios_clientes (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null unique,
    nombre_gimnasio text not null,
    propietario text,
    telefono text,
    email text,
    plan text not null default 'basico',
    estado text not null default 'prueba'
        check (estado in ('activo', 'prueba', 'suspendido', 'cancelado')),
    fecha_inicio date not null default current_date,
    fecha_vencimiento date,
    mensualidad numeric(12, 2) not null default 0,
    estado_pago_saas text not null default 'pendiente'
        check (estado_pago_saas in ('al_dia', 'pendiente', 'vencido', 'exonerado')),
    estado_tecnico text not null default 'operativo'
        check (estado_tecnico in ('operativo', 'revision', 'incidente')),
    usuarios_count integer not null default 0 check (usuarios_count >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_gimnasios_clientes_estado
    on public.gimnasios_clientes (estado);

create index if not exists idx_gimnasios_clientes_vencimiento
    on public.gimnasios_clientes (fecha_vencimiento);

create table if not exists public.soporte_accesos (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios_clientes (gimnasio_id) on delete cascade,
    autorizado_por uuid not null references auth.users (id),
    fecha_inicio timestamptz not null default now(),
    fecha_fin timestamptz not null,
    motivo text not null,
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'activo', 'vencido', 'revocado')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (fecha_fin > fecha_inicio)
);

create index if not exists idx_soporte_accesos_gimnasio_estado
    on public.soporte_accesos (gimnasio_id, estado, fecha_inicio, fecha_fin);

create or replace function app_private.current_gimnasio_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
    select p.gimnasio_id::uuid
    from public.perfiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.estado, 'activo')) = 'activo'
    limit 1
$$;

create or replace function app_private.current_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
    select lower(coalesce(p.rol, 'recepcion'))
    from public.perfiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.estado, 'activo')) = 'activo'
    limit 1
$$;

create or replace function app_private.is_super_admin_saas()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select coalesce(app_private.current_role() = 'super_admin_saas', false)
$$;

create or replace function app_private.cliente_saas_activo(p_gimnasio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(exists (
        select 1
        from public.gimnasios_clientes gc
        where gc.gimnasio_id = p_gimnasio_id
          and gc.estado in ('activo', 'prueba')
    ), true)
$$;

create or replace function app_private.soporte_activo_para_gimnasio(p_gimnasio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.soporte_accesos sa
        where sa.gimnasio_id = p_gimnasio_id
          and sa.estado = 'activo'
          and now() between sa.fecha_inicio and sa.fecha_fin
    )
$$;

revoke all on function app_private.current_gimnasio_id() from public;
revoke all on function app_private.current_role() from public;
revoke all on function app_private.is_super_admin_saas() from public;
revoke all on function app_private.cliente_saas_activo(uuid) from public;
revoke all on function app_private.soporte_activo_para_gimnasio(uuid) from public;
grant execute on function app_private.current_gimnasio_id() to authenticated;
grant execute on function app_private.current_role() to authenticated;
grant execute on function app_private.is_super_admin_saas() to authenticated;
grant execute on function app_private.cliente_saas_activo(uuid) to authenticated;
grant execute on function app_private.soporte_activo_para_gimnasio(uuid) to authenticated;

alter table public.gimnasios_clientes enable row level security;
alter table public.soporte_accesos enable row level security;

drop policy if exists "Michel Soft lee metadatos SaaS" on public.gimnasios_clientes;
create policy "Michel Soft lee metadatos SaaS"
on public.gimnasios_clientes
for select
to authenticated
using (app_private.is_super_admin_saas());

drop policy if exists "Admin gimnasio lee su estado SaaS" on public.gimnasios_clientes;
create policy "Admin gimnasio lee su estado SaaS"
on public.gimnasios_clientes
for select
to authenticated
using (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "Michel Soft administra metadatos SaaS" on public.gimnasios_clientes;
create policy "Michel Soft administra metadatos SaaS"
on public.gimnasios_clientes
for all
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

drop policy if exists "Admin gimnasio gestiona soporte propio" on public.soporte_accesos;
create policy "Admin gimnasio gestiona soporte propio"
on public.soporte_accesos
for all
to authenticated
using (
    gimnasio_id = app_private.current_gimnasio_id()
    and app_private.current_role() = 'administrador'
)
with check (
    gimnasio_id = app_private.current_gimnasio_id()
    and autorizado_por = auth.uid()
    and app_private.current_role() = 'administrador'
);

drop policy if exists "Michel Soft lee soporte autorizado" on public.soporte_accesos;
create policy "Michel Soft lee soporte autorizado"
on public.soporte_accesos
for select
to authenticated
using (app_private.is_super_admin_saas());

-- Agregar el rol interno en public.perfiles.
-- Si existe un CHECK constraint sobre rol, actualizalo para incluir:
-- ('administrador', 'recepcion', 'super_admin_saas')
-- No usar user_metadata para asignar este rol.

-- Politicas opcionales de soporte autorizado para datos operativos:
-- Michel Soft solo puede leer datos privados durante una ventana aprobada.
do $$
declare
    tabla text;
begin
    foreach tabla in array array[
        'miembros',
        'pagos',
        'asistencias',
        'productos',
        'ventas',
        'venta_detalles',
        'facturas',
        'cajas_turno',
        'ingresos_diarios'
    ]
    loop
        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = tabla
              and column_name = 'gimnasio_id'
        ) then
            execute format('drop policy if exists %I on public.%I', 'Michel Soft soporte temporal ' || tabla, tabla);
            execute format(
                'create policy %I on public.%I for select to authenticated using (app_private.is_super_admin_saas() and app_private.soporte_activo_para_gimnasio(gimnasio_id::uuid))',
                'Michel Soft soporte temporal ' || tabla,
                tabla
            );
        end if;
    end loop;
end $$;

-- Recomendacion de endurecimiento para TODAS las policies operativas existentes:
-- agregar app_private.cliente_saas_activo(gimnasio_id::uuid) al USING/WITH CHECK
-- para que un gimnasio suspendido no pueda leer ni modificar datos.

notify pgrst, 'reload schema';
