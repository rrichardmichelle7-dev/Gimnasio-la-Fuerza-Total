-- Kilvio FIT - Supabase multi-gimnasio/SaaS schema
-- Ejecutar desde Supabase SQL Editor con un usuario propietario del proyecto.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table if not exists public.gimnasios (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    telefono text,
    email text,
    direccion text,
    logo_url text,
    estado text not null default 'activo',
    plan text not null default 'basico',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint gimnasios_estado_check check (estado in ('activo', 'inactivo', 'suspendido')),
    constraint gimnasios_plan_check check (plan in ('basico', 'pro', 'enterprise'))
);

create table if not exists public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    gimnasio_id uuid not null references public.gimnasios(id) on delete restrict,
    nombre text not null,
    telefono text,
    rol text not null default 'recepcion',
    estado text not null default 'activo',
    permisos jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint perfiles_rol_check check (rol in ('administrador', 'recepcion', 'entrenador')),
    constraint perfiles_estado_check check (estado in ('activo', 'inactivo')),
    constraint perfiles_permisos_array_check check (jsonb_typeof(permisos) = 'array')
);

create table if not exists public.miembros (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    nombre text not null,
    cedula text,
    telefono text,
    fecha_registro date not null default current_date,
    estado text not null default 'activo',
    monto_mensual numeric(12,2) not null default 0,
    dia_pago int2 not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint miembros_estado_check check (estado in ('activo', 'inactivo')),
    constraint miembros_monto_check check (monto_mensual >= 0),
    constraint miembros_dia_pago_check check (dia_pago between 1 and 31),
    constraint miembros_cedula_gimnasio_unique unique (gimnasio_id, cedula)
);

create table if not exists public.pagos (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    miembro_id uuid not null references public.miembros(id) on delete restrict,
    monto numeric(12,2) not null,
    mes text not null,
    fecha_pago date not null default current_date,
    metodo_pago text not null,
    referencia_pago text,
    estado text not null default 'Pagado',
    concepto text not null default 'mensualidad',
    numero_recibo text,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint pagos_monto_check check (monto > 0),
    constraint pagos_estado_check check (estado in ('Pagado', 'Pendiente', 'Anulado')),
    constraint pagos_metodo_check check (metodo_pago in ('Efectivo', 'Tarjeta', 'Transferencia')),
    constraint pagos_recibo_gimnasio_unique unique (gimnasio_id, numero_recibo)
);

create table if not exists public.asistencias (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    miembro_id uuid not null references public.miembros(id) on delete cascade,
    fecha date not null default current_date,
    hora_llegada time not null default localtime,
    estado text not null default 'Presente',
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint asistencias_estado_check check (estado in ('Presente', 'Ausente')),
    constraint asistencias_miembro_fecha_unique unique (gimnasio_id, miembro_id, fecha)
);

create table if not exists public.ingresos_diarios (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    fecha date not null default current_date,
    cantidad int4 not null,
    precio_unitario numeric(12,2) not null,
    total numeric(12,2) generated always as (cantidad * precio_unitario) stored,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint ingresos_diarios_cantidad_check check (cantidad > 0),
    constraint ingresos_diarios_precio_check check (precio_unitario >= 0)
);

create table if not exists public.productos (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    nombre text not null,
    categoria text not null default 'Otros',
    precio numeric(12,2) not null,
    costo numeric(12,2) not null default 0,
    stock int4 not null default 0,
    stock_minimo int4 not null default 0,
    imagen_url text,
    estado text not null default 'activo',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint productos_precio_check check (precio >= 0),
    constraint productos_costo_check check (costo >= 0),
    constraint productos_stock_check check (stock >= 0),
    constraint productos_stock_minimo_check check (stock_minimo >= 0),
    constraint productos_estado_check check (estado in ('activo', 'inactivo'))
);

create table if not exists public.ventas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    producto_id uuid not null references public.productos(id) on delete restrict,
    cantidad int4 not null,
    precio_unitario numeric(12,2) not null,
    total numeric(12,2) generated always as (cantidad * precio_unitario) stored,
    metodo_pago text not null,
    referencia_pago text,
    fecha date not null default current_date,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint ventas_cantidad_check check (cantidad > 0),
    constraint ventas_precio_check check (precio_unitario >= 0),
    constraint ventas_metodo_check check (metodo_pago in ('Efectivo', 'Tarjeta', 'Transferencia'))
);

create table if not exists public.configuracion_mensualidad (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    monto_mensual numeric(12,2) not null default 750,
    entrada_diaria numeric(12,2) not null default 40,
    dias_prorroga int2 not null default 3,
    estado text not null default 'Activo',
    nota text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint configuracion_mensualidad_gimnasio_unique unique (gimnasio_id),
    constraint configuracion_mensualidad_monto_check check (monto_mensual > 0),
    constraint configuracion_mensualidad_entrada_check check (entrada_diaria >= 0),
    constraint configuracion_mensualidad_prorroga_check check (dias_prorroga >= 0),
    constraint configuracion_mensualidad_estado_check check (estado in ('Activo', 'Inactivo'))
);

create table if not exists public.notificaciones (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    miembro_id uuid references public.miembros(id) on delete cascade,
    tipo text not null,
    canal text not null,
    mensaje text not null,
    estado text not null default 'pendiente',
    fecha_programada timestamptz,
    fecha_enviada timestamptz,
    created_at timestamptz not null default now(),
    constraint notificaciones_tipo_check check (tipo in ('pago', 'asistencia', 'general')),
    constraint notificaciones_canal_check check (canal in ('whatsapp', 'email', 'sms', 'sistema')),
    constraint notificaciones_estado_check check (estado in ('pendiente', 'enviada', 'fallida', 'cancelada'))
);

create index if not exists idx_perfiles_gimnasio_id on public.perfiles(gimnasio_id);
create index if not exists idx_miembros_gimnasio_estado on public.miembros(gimnasio_id, estado);
create index if not exists idx_miembros_busqueda on public.miembros(gimnasio_id, nombre, cedula);
create index if not exists idx_pagos_gimnasio_fecha on public.pagos(gimnasio_id, fecha_pago desc);
create index if not exists idx_pagos_miembro on public.pagos(miembro_id);
create index if not exists idx_asistencias_gimnasio_fecha on public.asistencias(gimnasio_id, fecha desc);
create index if not exists idx_ingresos_diarios_gimnasio_fecha on public.ingresos_diarios(gimnasio_id, fecha desc);
create index if not exists idx_productos_gimnasio_estado on public.productos(gimnasio_id, estado);
create index if not exists idx_ventas_gimnasio_fecha on public.ventas(gimnasio_id, fecha desc);
create index if not exists idx_notificaciones_gimnasio_estado on public.notificaciones(gimnasio_id, estado, fecha_programada);

drop trigger if exists set_gimnasios_updated_at on public.gimnasios;
create trigger set_gimnasios_updated_at
before update on public.gimnasios
for each row execute function public.set_updated_at();

drop trigger if exists set_perfiles_updated_at on public.perfiles;
create trigger set_perfiles_updated_at
before update on public.perfiles
for each row execute function public.set_updated_at();

drop trigger if exists set_miembros_updated_at on public.miembros;
create trigger set_miembros_updated_at
before update on public.miembros
for each row execute function public.set_updated_at();

drop trigger if exists set_productos_updated_at on public.productos;
create trigger set_productos_updated_at
before update on public.productos
for each row execute function public.set_updated_at();

drop trigger if exists set_configuracion_mensualidad_updated_at on public.configuracion_mensualidad;
create trigger set_configuracion_mensualidad_updated_at
before update on public.configuracion_mensualidad
for each row execute function public.set_updated_at();

create or replace function public.current_gimnasio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select gimnasio_id from public.perfiles where id = auth.uid() and estado = 'activo';
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select rol from public.perfiles where id = auth.uid() and estado = 'activo';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_user_role() = 'administrador', false);
$$;

alter table public.gimnasios enable row level security;
alter table public.perfiles enable row level security;
alter table public.miembros enable row level security;
alter table public.pagos enable row level security;
alter table public.asistencias enable row level security;
alter table public.ingresos_diarios enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.configuracion_mensualidad enable row level security;
alter table public.notificaciones enable row level security;

create policy "Usuarios ven su gimnasio"
on public.gimnasios for select
to authenticated
using (id = public.current_gimnasio_id());

create policy "Administradores actualizan su gimnasio"
on public.gimnasios for update
to authenticated
using (id = public.current_gimnasio_id() and public.is_admin())
with check (id = public.current_gimnasio_id() and public.is_admin());

create policy "Usuarios ven perfiles de su gimnasio"
on public.perfiles for select
to authenticated
using (id = auth.uid() or gimnasio_id = public.current_gimnasio_id());

create policy "Usuarios actualizan su perfil basico"
on public.perfiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and gimnasio_id = public.current_gimnasio_id());

create policy "Administradores gestionan perfiles de su gimnasio"
on public.perfiles for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());

create policy "Miembros aislados por gimnasio"
on public.miembros for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Pagos aislados por gimnasio"
on public.pagos for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Asistencias aisladas por gimnasio"
on public.asistencias for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Ingresos diarios aislados por gimnasio"
on public.ingresos_diarios for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Productos aislados por gimnasio"
on public.productos for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Ventas aisladas por gimnasio"
on public.ventas for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Configuracion aislada por gimnasio"
on public.configuracion_mensualidad for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

create policy "Notificaciones aisladas por gimnasio"
on public.notificaciones for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id())
with check (gimnasio_id = public.current_gimnasio_id());

-- Primer administrador manual:
-- 1. Crear el usuario en Authentication > Users.
-- 2. Ejecutar:
--    insert into public.gimnasios (nombre, telefono, email, direccion)
--    values ('Kilvio FIT', '809-000-0000', 'admin@kilviofit.com', 'Direccion del gimnasio')
--    returning id;
-- 3. Usar el UUID retornado y el UUID del usuario auth para:
--    insert into public.perfiles (id, gimnasio_id, nombre, rol, permisos)
--    values (
--      'AUTH_USER_UUID',
--      'GIMNASIO_UUID',
--      'Administrador',
--      'administrador',
--      '["dashboard","miembros","asistencia","ingresos_diarios","pagos","registrar_pago","inventario","reportes","mensualidad","configuracion"]'::jsonb
--    );
-- 4. Crear configuracion inicial:
--    insert into public.configuracion_mensualidad (gimnasio_id)
--    values ('GIMNASIO_UUID');
