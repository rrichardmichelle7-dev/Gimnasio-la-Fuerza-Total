-- Kilvio FIT POS - tablas futuras Supabase multi-gimnasio.
-- TODO SUPABASE: ejecutar cuando se migre el POS desde localStorage a Supabase.

create table if not exists public.productos (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null,
    nombre text not null,
    categoria text not null,
    precio numeric(12,2) not null default 0,
    costo numeric(12,2) not null default 0,
    stock int not null default 0,
    stock_minimo int not null default 0,
    imagen_url text,
    estado text not null default 'Activo',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.proveedores (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null,
    nombre text not null,
    telefono text,
    email text,
    direccion text,
    producto_principal text,
    estado text not null default 'Activo',
    observaciones text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.compras_proveedores (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null,
    proveedor_id uuid references public.proveedores(id),
    producto_id uuid references public.productos(id),
    cantidad int not null,
    costo_unitario numeric(12,2) not null default 0,
    total numeric(12,2) not null default 0,
    fecha date not null default current_date,
    usuario_registro uuid,
    created_at timestamptz not null default now()
);

create table if not exists public.ventas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null,
    numero_recibo text not null,
    fecha date not null default current_date,
    cliente text,
    usuario_registro uuid,
    metodo_pago text not null,
    referencia_pago text,
    voucher text,
    subtotal numeric(12,2) not null default 0,
    total numeric(12,2) not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.venta_detalles (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null,
    venta_id uuid references public.ventas(id) on delete cascade,
    producto_id uuid references public.productos(id),
    producto_nombre text not null,
    cantidad int not null,
    precio_unitario numeric(12,2) not null default 0,
    total numeric(12,2) not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.movimientos_inventario (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null,
    producto_id uuid references public.productos(id),
    tipo text not null,
    cantidad int not null,
    motivo text,
    referencia text,
    usuario_registro uuid,
    created_at timestamptz not null default now()
);

create index if not exists idx_productos_gimnasio_categoria on public.productos(gimnasio_id, categoria);
create index if not exists idx_productos_gimnasio_estado on public.productos(gimnasio_id, estado);
create index if not exists idx_proveedores_gimnasio_estado on public.proveedores(gimnasio_id, estado);
create index if not exists idx_compras_gimnasio_fecha on public.compras_proveedores(gimnasio_id, fecha desc);
create index if not exists idx_ventas_gimnasio_fecha on public.ventas(gimnasio_id, fecha desc);
create index if not exists idx_movimientos_gimnasio_producto on public.movimientos_inventario(gimnasio_id, producto_id, created_at desc);

-- RLS esperado:
-- alter table public.productos enable row level security;
-- alter table public.proveedores enable row level security;
-- alter table public.compras_proveedores enable row level security;
-- alter table public.ventas enable row level security;
-- alter table public.venta_detalles enable row level security;
-- alter table public.movimientos_inventario enable row level security;
-- Crear politicas por gimnasio_id igual que el resto del sistema SaaS.
