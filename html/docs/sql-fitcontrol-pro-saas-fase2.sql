-- FitControl Pro - Fase 2 Billing y gestion comercial
-- Ejecutar despues de docs/sql-fitcontrol-pro-saas.sql.
-- Mantiene billing SaaS separado de datos operativos privados de cada gimnasio.

create table if not exists public.planes_saas (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    nombre text not null,
    descripcion text,
    precio_mensual numeric(12, 2) not null check (precio_mensual >= 0),
    moneda text not null default 'DOP',
    limite_usuarios integer,
    limite_miembros integer,
    incluye_soporte boolean not null default true,
    estado text not null default 'activo'
        check (estado in ('activo', 'inactivo')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.pagos_saas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios_clientes (gimnasio_id) on delete restrict,
    plan_id uuid references public.planes_saas (id),
    periodo_inicio date not null,
    periodo_fin date not null,
    fecha_vencimiento date not null,
    fecha_pago timestamptz,
    monto numeric(12, 2) not null check (monto >= 0),
    moneda text not null default 'DOP',
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'pagado', 'vencido', 'anulado')),
    metodo_pago text,
    referencia_pago text,
    notas text,
    registrado_por uuid references auth.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (periodo_fin >= periodo_inicio)
);

create unique index if not exists idx_pagos_saas_periodo_unico
    on public.pagos_saas (gimnasio_id, periodo_inicio, periodo_fin)
    where estado <> 'anulado';

create index if not exists idx_pagos_saas_estado_vencimiento
    on public.pagos_saas (estado, fecha_vencimiento);

create index if not exists idx_pagos_saas_gimnasio_fecha
    on public.pagos_saas (gimnasio_id, fecha_vencimiento desc);

create table if not exists public.tickets_soporte (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios_clientes (gimnasio_id) on delete cascade,
    creado_por uuid references auth.users (id),
    asignado_a uuid references auth.users (id),
    titulo text not null,
    descripcion text,
    categoria text not null default 'general'
        check (categoria in ('general', 'billing', 'tecnico', 'capacitacion')),
    prioridad text not null default 'media'
        check (prioridad in ('baja', 'media', 'alta', 'critica')),
    estado text not null default 'abierto'
        check (estado in ('abierto', 'en_proceso', 'pendiente_cliente', 'resuelto', 'cerrado')),
    fecha_cierre timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_tickets_soporte_estado_prioridad
    on public.tickets_soporte (estado, prioridad, created_at desc);

create index if not exists idx_tickets_soporte_gimnasio_estado
    on public.tickets_soporte (gimnasio_id, estado);

create table if not exists public.alertas_vencimiento_saas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios_clientes (gimnasio_id) on delete cascade,
    pago_saas_id uuid references public.pagos_saas (id) on delete cascade,
    tipo text not null check (tipo in ('proximo_vencimiento', 'vencido', 'suspension')),
    mensaje text not null,
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'enviada', 'cancelada')),
    fecha_programada date not null default current_date,
    fecha_envio timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_alertas_vencimiento_estado_fecha
    on public.alertas_vencimiento_saas (estado, fecha_programada);

alter table public.planes_saas enable row level security;
alter table public.pagos_saas enable row level security;
alter table public.tickets_soporte enable row level security;
alter table public.alertas_vencimiento_saas enable row level security;

drop policy if exists "Michel Soft administra planes SaaS" on public.planes_saas;
create policy "Michel Soft administra planes SaaS"
on public.planes_saas
for all
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

drop policy if exists "Gimnasios leen planes activos" on public.planes_saas;
create policy "Gimnasios leen planes activos"
on public.planes_saas
for select
to authenticated
using (estado = 'activo' or app_private.is_super_admin_saas());

drop policy if exists "Michel Soft administra pagos SaaS" on public.pagos_saas;
create policy "Michel Soft administra pagos SaaS"
on public.pagos_saas
for all
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

drop policy if exists "Gimnasio lee su billing SaaS" on public.pagos_saas;
create policy "Gimnasio lee su billing SaaS"
on public.pagos_saas
for select
to authenticated
using (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "Michel Soft administra tickets soporte" on public.tickets_soporte;
create policy "Michel Soft administra tickets soporte"
on public.tickets_soporte
for all
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

drop policy if exists "Gimnasio gestiona sus tickets soporte" on public.tickets_soporte;
create policy "Gimnasio gestiona sus tickets soporte"
on public.tickets_soporte
for all
to authenticated
using (gimnasio_id = app_private.current_gimnasio_id())
with check (gimnasio_id = app_private.current_gimnasio_id());

drop policy if exists "Michel Soft lee alertas vencimiento SaaS" on public.alertas_vencimiento_saas;
create policy "Michel Soft lee alertas vencimiento SaaS"
on public.alertas_vencimiento_saas
for all
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

drop policy if exists "Gimnasio lee sus alertas SaaS" on public.alertas_vencimiento_saas;
create policy "Gimnasio lee sus alertas SaaS"
on public.alertas_vencimiento_saas
for select
to authenticated
using (gimnasio_id = app_private.current_gimnasio_id());

create or replace function app_private.generar_renovaciones_saas(p_fecha date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    creados integer := 0;
begin
    insert into public.pagos_saas (
        gimnasio_id,
        periodo_inicio,
        periodo_fin,
        fecha_vencimiento,
        monto,
        moneda,
        estado
    )
    select
        gc.gimnasio_id,
        (gc.fecha_vencimiento + interval '1 day')::date,
        (gc.fecha_vencimiento + interval '1 month')::date,
        (gc.fecha_vencimiento + interval '1 month')::date,
        gc.mensualidad,
        'DOP',
        'pendiente'
    from public.gimnasios_clientes gc
    where gc.estado in ('activo', 'prueba')
      and gc.fecha_vencimiento is not null
      and gc.fecha_vencimiento <= p_fecha + interval '7 days'
      and not exists (
          select 1
          from public.pagos_saas ps
          where ps.gimnasio_id = gc.gimnasio_id
            and ps.periodo_inicio = (gc.fecha_vencimiento + interval '1 day')::date
            and ps.estado <> 'anulado'
      );

    get diagnostics creados = row_count;
    return creados;
end;
$$;

create or replace function app_private.generar_alertas_vencimiento_saas(p_fecha date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    creadas integer := 0;
begin
    insert into public.alertas_vencimiento_saas (gimnasio_id, pago_saas_id, tipo, mensaje, fecha_programada)
    select
        ps.gimnasio_id,
        ps.id,
        case when ps.fecha_vencimiento < p_fecha then 'vencido' else 'proximo_vencimiento' end,
        case
            when ps.fecha_vencimiento < p_fecha then 'Pago SaaS vencido. Regularizar para evitar suspension.'
            else 'Pago SaaS proximo a vencer.'
        end,
        p_fecha
    from public.pagos_saas ps
    where ps.estado in ('pendiente', 'vencido')
      and ps.fecha_vencimiento <= p_fecha + interval '5 days'
      and not exists (
          select 1
          from public.alertas_vencimiento_saas av
          where av.pago_saas_id = ps.id
            and av.tipo = case when ps.fecha_vencimiento < p_fecha then 'vencido' else 'proximo_vencimiento' end
            and av.fecha_programada = p_fecha
      );

    get diagnostics creadas = row_count;
    return creadas;
end;
$$;

create or replace function app_private.suspender_clientes_saas_morosos(
    p_fecha date default current_date,
    p_dias_gracia integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    suspendidos integer := 0;
begin
    update public.pagos_saas
    set estado = 'vencido',
        updated_at = now()
    where estado = 'pendiente'
      and fecha_vencimiento < p_fecha;

    update public.gimnasios_clientes gc
    set estado = 'suspendido',
        estado_pago_saas = 'vencido',
        updated_at = now()
    where gc.estado in ('activo', 'prueba')
      and exists (
          select 1
          from public.pagos_saas ps
          where ps.gimnasio_id = gc.gimnasio_id
            and ps.estado = 'vencido'
            and ps.fecha_vencimiento < p_fecha - make_interval(days => greatest(p_dias_gracia, 0))
      );

    get diagnostics suspendidos = row_count;

    insert into public.alertas_vencimiento_saas (gimnasio_id, tipo, mensaje, fecha_programada)
    select
        gc.gimnasio_id,
        'suspension',
        'Cuenta suspendida automaticamente por mora SaaS.',
        p_fecha
    from public.gimnasios_clientes gc
    where gc.estado = 'suspendido'
      and not exists (
          select 1
          from public.alertas_vencimiento_saas av
          where av.gimnasio_id = gc.gimnasio_id
            and av.tipo = 'suspension'
            and av.fecha_programada = p_fecha
      );

    return suspendidos;
end;
$$;

create or replace function app_private.marcar_pago_saas_pagado(
    p_pago_saas_id uuid,
    p_metodo_pago text,
    p_referencia_pago text default null,
    p_fecha_pago timestamptz default now()
)
returns public.pagos_saas
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    pago_actualizado public.pagos_saas;
begin
    if not app_private.is_super_admin_saas() then
        raise exception 'No autorizado';
    end if;

    update public.pagos_saas ps
    set estado = 'pagado',
        metodo_pago = p_metodo_pago,
        referencia_pago = p_referencia_pago,
        fecha_pago = p_fecha_pago,
        registrado_por = auth.uid(),
        updated_at = now()
    where ps.id = p_pago_saas_id
    returning * into pago_actualizado;

    if pago_actualizado.id is null then
        raise exception 'Pago SaaS no encontrado';
    end if;

    update public.gimnasios_clientes gc
    set estado = case when gc.estado = 'suspendido' then 'activo' else gc.estado end,
        estado_pago_saas = 'al_dia',
        fecha_vencimiento = greatest(coalesce(gc.fecha_vencimiento, pago_actualizado.periodo_fin), pago_actualizado.periodo_fin),
        updated_at = now()
    where gc.gimnasio_id = pago_actualizado.gimnasio_id;

    return pago_actualizado;
end;
$$;

revoke all on function app_private.generar_renovaciones_saas(date) from public;
revoke all on function app_private.generar_alertas_vencimiento_saas(date) from public;
revoke all on function app_private.suspender_clientes_saas_morosos(date, integer) from public;
revoke all on function app_private.marcar_pago_saas_pagado(uuid, text, text, timestamptz) from public;
grant execute on function app_private.marcar_pago_saas_pagado(uuid, text, text, timestamptz) to authenticated;

-- Programacion diaria opcional si pg_cron esta habilitado en Supabase:
-- select cron.schedule('fitcontrol-pro-renovaciones-diarias', '15 3 * * *', $$select app_private.generar_renovaciones_saas(current_date);$$);
-- select cron.schedule('fitcontrol-pro-alertas-vencimiento', '20 3 * * *', $$select app_private.generar_alertas_vencimiento_saas(current_date);$$);
-- select cron.schedule('fitcontrol-pro-suspension-mora', '30 3 * * *', $$select app_private.suspender_clientes_saas_morosos(current_date, 3);$$);

notify pgrst, 'reload schema';
