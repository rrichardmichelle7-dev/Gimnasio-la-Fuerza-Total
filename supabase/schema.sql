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

create table if not exists public.proveedores (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    nombre text not null,
    telefono text,
    email text,
    direccion text,
    producto_principal text,
    observaciones text,
    estado text not null default 'activo',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint proveedores_estado_check check (estado in ('activo', 'inactivo'))
);

create table if not exists public.compras_proveedores (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    proveedor_id uuid references public.proveedores(id) on delete set null,
    producto_id uuid not null references public.productos(id) on delete restrict,
    cantidad int4 not null,
    costo_unitario numeric(12,2) not null,
    total numeric(12,2) generated always as (cantidad * costo_unitario) stored,
    fecha date not null default current_date,
    observacion text,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint compras_proveedores_cantidad_check check (cantidad > 0),
    constraint compras_proveedores_costo_check check (costo_unitario >= 0)
);

create table if not exists public.ventas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    fecha date not null default current_date,
    metodo_pago text not null,
    referencia_pago text,
    total numeric(12,2) not null default 0,
    numero_recibo text,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint ventas_total_check check (total >= 0),
    constraint ventas_metodo_check check (metodo_pago in ('Efectivo', 'Tarjeta', 'Transferencia'))
);

create table if not exists public.venta_detalles (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    venta_id uuid not null references public.ventas(id) on delete cascade,
    producto_id uuid not null references public.productos(id) on delete restrict,
    cantidad int4 not null,
    precio_unitario numeric(12,2) not null,
    costo_unitario numeric(12,2) not null default 0,
    total numeric(12,2) generated always as (cantidad * precio_unitario) stored,
    created_at timestamptz not null default now(),
    constraint venta_detalles_cantidad_check check (cantidad > 0),
    constraint venta_detalles_precio_check check (precio_unitario >= 0),
    constraint venta_detalles_costo_check check (costo_unitario >= 0)
);

create table if not exists public.movimientos_inventario (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    producto_id uuid not null references public.productos(id) on delete restrict,
    tipo text not null,
    cantidad int4 not null,
    stock_posterior int4 not null,
    referencia_tipo text,
    referencia_id uuid,
    observacion text,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint movimientos_inventario_tipo_check check (tipo in ('entrada', 'salida', 'ajuste')),
    constraint movimientos_inventario_cantidad_check check (cantidad > 0),
    constraint movimientos_inventario_stock_check check (stock_posterior >= 0)
);

create table if not exists public.contadores_recibos (
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    tipo text not null,
    ultimo_numero int8 not null default 0,
    updated_at timestamptz not null default now(),
    primary key (gimnasio_id, tipo),
    constraint contadores_recibos_tipo_check check (tipo in ('pago', 'venta', 'factura'))
);

create table if not exists public.facturas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios(id) on delete cascade,
    tipo text not null,
    referencia_id uuid not null,
    numero_recibo text not null,
    fecha date not null default current_date,
    cliente text,
    concepto text not null,
    metodo_pago text,
    referencia_pago text,
    total numeric(12,2) not null default 0,
    usuario_registro uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint facturas_tipo_check check (tipo in ('mensualidad', 'venta_producto', 'entrada_diaria')),
    constraint facturas_total_check check (total >= 0),
    constraint facturas_numero_unique unique (gimnasio_id, numero_recibo),
    constraint facturas_referencia_unique unique (gimnasio_id, tipo, referencia_id)
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

alter table public.pagos add column if not exists numero_recibo text;
alter table public.ventas add column if not exists numero_recibo text;
alter table public.facturas add column if not exists metodo_pago text;
alter table public.facturas add column if not exists referencia_pago text;

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
create index if not exists idx_proveedores_gimnasio_estado on public.proveedores(gimnasio_id, estado);
create index if not exists idx_compras_proveedores_gimnasio_fecha on public.compras_proveedores(gimnasio_id, fecha desc);
create index if not exists idx_ventas_gimnasio_fecha on public.ventas(gimnasio_id, fecha desc);
create index if not exists idx_venta_detalles_venta on public.venta_detalles(venta_id);
create index if not exists idx_movimientos_inventario_gimnasio_producto on public.movimientos_inventario(gimnasio_id, producto_id, created_at desc);
create index if not exists idx_facturas_gimnasio_fecha on public.facturas(gimnasio_id, fecha desc);
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

drop trigger if exists set_proveedores_updated_at on public.proveedores;
create trigger set_proveedores_updated_at
before update on public.proveedores
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
alter table public.proveedores enable row level security;
alter table public.compras_proveedores enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.contadores_recibos enable row level security;
alter table public.facturas enable row level security;
alter table public.configuracion_mensualidad enable row level security;
alter table public.notificaciones enable row level security;

drop policy if exists "Usuarios ven su gimnasio" on public.gimnasios;
drop policy if exists "Administradores actualizan su gimnasio" on public.gimnasios;
drop policy if exists "Usuarios ven perfiles de su gimnasio" on public.perfiles;
drop policy if exists "Usuarios actualizan su perfil basico" on public.perfiles;
drop policy if exists "Administradores gestionan perfiles de su gimnasio" on public.perfiles;
drop policy if exists "Miembros aislados por gimnasio" on public.miembros;
drop policy if exists "Pagos aislados por gimnasio" on public.pagos;
drop policy if exists "Pagos visibles por gimnasio" on public.pagos;
drop policy if exists "Asistencias aisladas por gimnasio" on public.asistencias;
drop policy if exists "Ingresos diarios aislados por gimnasio" on public.ingresos_diarios;
drop policy if exists "Productos visibles por gimnasio" on public.productos;
drop policy if exists "Administradores gestionan productos" on public.productos;
drop policy if exists "Administradores gestionan proveedores" on public.proveedores;
drop policy if exists "Administradores gestionan compras proveedores" on public.compras_proveedores;
drop policy if exists "Ventas visibles por gimnasio" on public.ventas;
drop policy if exists "Usuarios registran ventas de su gimnasio" on public.ventas;
drop policy if exists "Detalles visibles por gimnasio" on public.venta_detalles;
drop policy if exists "Usuarios registran detalles de venta" on public.venta_detalles;
drop policy if exists "Movimientos visibles por gimnasio" on public.movimientos_inventario;
drop policy if exists "Usuarios registran salidas de inventario" on public.movimientos_inventario;
drop policy if exists "Contadores recibos solo administradores" on public.contadores_recibos;
drop policy if exists "Facturas visibles por gimnasio" on public.facturas;
drop policy if exists "Facturas insertadas por usuarios del gimnasio" on public.facturas;
drop policy if exists "Configuracion aislada por gimnasio" on public.configuracion_mensualidad;
drop policy if exists "Notificaciones aisladas por gimnasio" on public.notificaciones;

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

create policy "Pagos visibles por gimnasio"
on public.pagos for select
to authenticated
using (gimnasio_id = public.current_gimnasio_id());

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

create policy "Productos visibles por gimnasio"
on public.productos for select
to authenticated
using (gimnasio_id = public.current_gimnasio_id());

create policy "Administradores gestionan productos"
on public.productos for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());

create policy "Administradores gestionan proveedores"
on public.proveedores for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());

create policy "Administradores gestionan compras proveedores"
on public.compras_proveedores for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());

create policy "Ventas visibles por gimnasio"
on public.ventas for select
to authenticated
using (gimnasio_id = public.current_gimnasio_id());

create policy "Detalles visibles por gimnasio"
on public.venta_detalles for select
to authenticated
using (gimnasio_id = public.current_gimnasio_id());

create policy "Movimientos visibles por gimnasio"
on public.movimientos_inventario for select
to authenticated
using (gimnasio_id = public.current_gimnasio_id());

create policy "Contadores recibos solo administradores"
on public.contadores_recibos for all
to authenticated
using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());

create policy "Facturas visibles por gimnasio"
on public.facturas for select
to authenticated
using (gimnasio_id = public.current_gimnasio_id());

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

create or replace function public.generar_numero_recibo(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gimnasio_id uuid := public.current_gimnasio_id();
    v_ultimo int8;
    v_prefijo text;
begin
    if (select auth.uid()) is null then
        raise exception 'Usuario no autenticado';
    end if;

    if v_gimnasio_id is null then
        raise exception 'Perfil sin gimnasio activo';
    end if;

    if p_tipo not in ('pago', 'venta', 'factura') then
        raise exception 'Tipo de recibo invalido';
    end if;

    insert into public.contadores_recibos (gimnasio_id, tipo, ultimo_numero)
    values (v_gimnasio_id, p_tipo, 1)
    on conflict (gimnasio_id, tipo)
    do update set
        ultimo_numero = public.contadores_recibos.ultimo_numero + 1,
        updated_at = now()
    returning ultimo_numero into v_ultimo;

    v_prefijo := case p_tipo
        when 'pago' then 'PAG'
        when 'venta' then 'VEN'
        else 'FAC'
    end;

    return v_prefijo || '-' || lpad(v_ultimo::text, 6, '0');
end;
$$;

create or replace function public.registrar_pago(
    p_miembro_id uuid,
    p_mes text,
    p_fecha_pago date default current_date,
    p_metodo_pago text default 'Efectivo',
    p_referencia_pago text default null
)
returns table (
    pago_id uuid,
    factura_id uuid,
    numero_recibo text,
    monto numeric,
    miembro_nombre text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gimnasio_id uuid := public.current_gimnasio_id();
    v_usuario_id uuid := auth.uid();
    v_miembro public.miembros%rowtype;
    v_monto numeric(12,2);
    v_pago_id uuid;
    v_factura_id uuid;
    v_numero text;
begin
    if v_usuario_id is null then
        raise exception 'Usuario no autenticado';
    end if;

    if v_gimnasio_id is null then
        raise exception 'Perfil sin gimnasio activo';
    end if;

    if p_metodo_pago not in ('Efectivo', 'Tarjeta', 'Transferencia') then
        raise exception 'Metodo de pago invalido';
    end if;

    if p_metodo_pago in ('Tarjeta', 'Transferencia') and nullif(trim(coalesce(p_referencia_pago, '')), '') is null then
        raise exception 'La referencia es obligatoria para tarjeta o transferencia';
    end if;

    select * into v_miembro
    from public.miembros
    where id = p_miembro_id
      and gimnasio_id = v_gimnasio_id
      and estado = 'activo'
    for update;

    if not found then
        raise exception 'Miembro no encontrado o inactivo';
    end if;

    select coalesce(nullif(v_miembro.monto_mensual, 0), cm.monto_mensual, 0)
    into v_monto
    from public.configuracion_mensualidad cm
    where cm.gimnasio_id = v_gimnasio_id
    limit 1;

    v_monto := coalesce(nullif(v_monto, 0), v_miembro.monto_mensual);

    if v_monto is null or v_monto <= 0 then
        raise exception 'Monto de mensualidad no configurado';
    end if;

    v_numero := public.generar_numero_recibo('pago');

    insert into public.pagos (
        gimnasio_id, miembro_id, monto, mes, fecha_pago, metodo_pago,
        referencia_pago, estado, concepto, numero_recibo, usuario_registro
    )
    values (
        v_gimnasio_id, p_miembro_id, v_monto, p_mes, coalesce(p_fecha_pago, current_date),
        p_metodo_pago, nullif(trim(coalesce(p_referencia_pago, '')), ''),
        'Pagado', 'mensualidad', v_numero, v_usuario_id
    )
    returning id into v_pago_id;

    insert into public.facturas (
        gimnasio_id, tipo, referencia_id, numero_recibo, fecha, cliente,
        concepto, metodo_pago, referencia_pago, total, usuario_registro
    )
    values (
        v_gimnasio_id, 'mensualidad', v_pago_id, v_numero, coalesce(p_fecha_pago, current_date),
        v_miembro.nombre, 'mensualidad', p_metodo_pago,
        nullif(trim(coalesce(p_referencia_pago, '')), ''), v_monto, v_usuario_id
    )
    returning id into v_factura_id;

    return query select v_pago_id, v_factura_id, v_numero, v_monto, v_miembro.nombre;
end;
$$;

create or replace function public.vender_producto(
    p_producto_id uuid,
    p_cantidad int4 default 1,
    p_metodo_pago text default 'Efectivo',
    p_referencia_pago text default null
)
returns table (
    venta_id uuid,
    factura_id uuid,
    numero_recibo text,
    total numeric,
    stock_posterior int4
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gimnasio_id uuid := public.current_gimnasio_id();
    v_usuario_id uuid := auth.uid();
    v_producto public.productos%rowtype;
    v_venta_id uuid;
    v_factura_id uuid;
    v_numero text;
    v_total numeric(12,2);
begin
    if v_usuario_id is null then
        raise exception 'Usuario no autenticado';
    end if;

    if v_gimnasio_id is null then
        raise exception 'Perfil sin gimnasio activo';
    end if;

    if p_cantidad is null or p_cantidad <= 0 then
        raise exception 'Cantidad invalida';
    end if;

    if p_metodo_pago not in ('Efectivo', 'Tarjeta', 'Transferencia') then
        raise exception 'Metodo de pago invalido';
    end if;

    if p_metodo_pago in ('Tarjeta', 'Transferencia') and nullif(trim(coalesce(p_referencia_pago, '')), '') is null then
        raise exception 'La referencia es obligatoria para tarjeta o transferencia';
    end if;

    select * into v_producto
    from public.productos
    where id = p_producto_id
      and gimnasio_id = v_gimnasio_id
      and estado = 'activo'
    for update;

    if not found then
        raise exception 'Producto no encontrado o inactivo';
    end if;

    if v_producto.stock < p_cantidad then
        raise exception 'Stock insuficiente';
    end if;

    v_total := v_producto.precio * p_cantidad;
    v_numero := public.generar_numero_recibo('venta');

    update public.productos
    set stock = stock - p_cantidad,
        updated_at = now()
    where id = v_producto.id;

    insert into public.ventas (
        gimnasio_id, fecha, metodo_pago, referencia_pago,
        total, numero_recibo, usuario_registro
    )
    values (
        v_gimnasio_id, current_date, p_metodo_pago,
        nullif(trim(coalesce(p_referencia_pago, '')), ''),
        v_total, v_numero, v_usuario_id
    )
    returning id into v_venta_id;

    insert into public.venta_detalles (
        gimnasio_id, venta_id, producto_id, cantidad, precio_unitario, costo_unitario
    )
    values (
        v_gimnasio_id, v_venta_id, v_producto.id, p_cantidad,
        v_producto.precio, v_producto.costo
    );

    insert into public.movimientos_inventario (
        gimnasio_id, producto_id, tipo, cantidad, stock_posterior,
        referencia_tipo, referencia_id, observacion, usuario_registro
    )
    values (
        v_gimnasio_id, v_producto.id, 'salida', p_cantidad,
        v_producto.stock - p_cantidad, 'venta', v_venta_id,
        p_metodo_pago, v_usuario_id
    );

    insert into public.facturas (
        gimnasio_id, tipo, referencia_id, numero_recibo, fecha, cliente,
        concepto, metodo_pago, referencia_pago, total, usuario_registro
    )
    values (
        v_gimnasio_id, 'venta_producto', v_venta_id, v_numero, current_date,
        'Cliente mostrador', 'venta de productos', p_metodo_pago,
        nullif(trim(coalesce(p_referencia_pago, '')), ''), v_total, v_usuario_id
    )
    returning id into v_factura_id;

    return query select v_venta_id, v_factura_id, v_numero, v_total, v_producto.stock - p_cantidad;
end;
$$;

create or replace function public.actualizar_stock(
    p_producto_id uuid,
    p_cantidad int4,
    p_costo_unitario numeric,
    p_proveedor_id uuid,
    p_fecha date default current_date,
    p_observacion text default null
)
returns table (
    compra_id uuid,
    stock_posterior int4,
    total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gimnasio_id uuid := public.current_gimnasio_id();
    v_usuario_id uuid := auth.uid();
    v_producto public.productos%rowtype;
    v_proveedor public.proveedores%rowtype;
    v_compra_id uuid;
    v_total numeric(12,2);
begin
    if v_usuario_id is null then
        raise exception 'Usuario no autenticado';
    end if;

    if v_gimnasio_id is null then
        raise exception 'Perfil sin gimnasio activo';
    end if;

    if not public.is_admin() then
        raise exception 'Solo administradores pueden actualizar stock';
    end if;

    if p_cantidad is null or p_cantidad <= 0 then
        raise exception 'Cantidad invalida';
    end if;

    if p_costo_unitario is null or p_costo_unitario < 0 then
        raise exception 'Costo unitario invalido';
    end if;

    select * into v_producto
    from public.productos
    where id = p_producto_id
      and gimnasio_id = v_gimnasio_id
    for update;

    if not found then
        raise exception 'Producto no encontrado';
    end if;

    select * into v_proveedor
    from public.proveedores
    where id = p_proveedor_id
      and gimnasio_id = v_gimnasio_id
      and estado = 'activo';

    if not found then
        raise exception 'Proveedor no encontrado o inactivo';
    end if;

    v_total := p_cantidad * p_costo_unitario;

    update public.productos
    set stock = stock + p_cantidad,
        costo = p_costo_unitario,
        updated_at = now()
    where id = v_producto.id;

    insert into public.compras_proveedores (
        gimnasio_id, proveedor_id, producto_id, cantidad, costo_unitario,
        fecha, observacion, usuario_registro
    )
    values (
        v_gimnasio_id, p_proveedor_id, p_producto_id, p_cantidad, p_costo_unitario,
        coalesce(p_fecha, current_date), p_observacion, v_usuario_id
    )
    returning id into v_compra_id;

    insert into public.movimientos_inventario (
        gimnasio_id, producto_id, tipo, cantidad, stock_posterior,
        referencia_tipo, referencia_id, observacion, usuario_registro
    )
    values (
        v_gimnasio_id, p_producto_id, 'entrada', p_cantidad,
        v_producto.stock + p_cantidad, 'compra_proveedor',
        v_compra_id, p_observacion, v_usuario_id
    );

    return query select v_compra_id, v_producto.stock + p_cantidad, v_total;
end;
$$;

revoke execute on function public.generar_numero_recibo(text) from public, anon;
revoke execute on function public.registrar_pago(uuid, text, date, text, text) from public, anon;
revoke execute on function public.vender_producto(uuid, int4, text, text) from public, anon;
revoke execute on function public.actualizar_stock(uuid, int4, numeric, uuid, date, text) from public, anon;
revoke execute on function public.current_gimnasio_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;

grant execute on function public.registrar_pago(uuid, text, date, text, text) to authenticated;
grant execute on function public.vender_producto(uuid, int4, text, text) to authenticated;
grant execute on function public.actualizar_stock(uuid, int4, numeric, uuid, date, text) to authenticated;
grant execute on function public.current_gimnasio_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

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
--      '["dashboard","miembros","asistencia","ingresos_diarios","pagos","registrar_pago","inventario","pos","proveedores","reportes","mensualidad","configuracion"]'::jsonb
--    );
-- 4. Crear configuracion inicial:
--    insert into public.configuracion_mensualidad (gimnasio_id)
--    values ('GIMNASIO_UUID');
