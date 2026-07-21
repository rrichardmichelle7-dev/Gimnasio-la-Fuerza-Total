-- Michel Soft - Facturacion SaaS y correcciones finales del panel.
-- Ejecutar en Supabase SQL Editor despues de los scripts SaaS existentes.
-- No modifica Auth, login ni tablas operativas privadas de los gimnasios.

create schema if not exists app_private;
grant usage on schema app_private to authenticated;

create table if not exists public.facturas_saas (
    id uuid primary key default gen_random_uuid(),
    gimnasio_id uuid not null references public.gimnasios_clientes (gimnasio_id) on delete restrict,
    pago_saas_id uuid references public.pagos_saas (id) on delete set null,
    numero_factura text not null unique,
    fecha_emision date not null default current_date,
    fecha_vencimiento date not null,
    periodo_inicio date not null,
    periodo_fin date not null,
    servicio text not null default 'FitControl Pro',
    plan text not null,
    cantidad numeric(12, 2) not null default 1 check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    itbis numeric(12, 2) not null default 0 check (itbis >= 0),
    total numeric(12, 2) not null check (total >= 0),
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'pagada', 'vencida', 'anulada')),
    metodo_pago text,
    referencia_pago text,
    observaciones text,
    cliente_nombre text not null,
    cliente_propietario text,
    cliente_telefono text,
    cliente_email text,
    cliente_direccion text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (fecha_vencimiento >= fecha_emision),
    check (periodo_fin >= periodo_inicio),
    check (total = subtotal + itbis)
);

create index if not exists idx_facturas_saas_gimnasio_fecha
    on public.facturas_saas (gimnasio_id, fecha_emision desc);

create index if not exists idx_facturas_saas_estado_vencimiento
    on public.facturas_saas (estado, fecha_vencimiento);

create table if not exists app_private.facturas_saas_contadores (
    anio integer primary key,
    ultimo_numero integer not null check (ultimo_numero > 0)
);

revoke all on table app_private.facturas_saas_contadores from public;
revoke all on table app_private.facturas_saas_contadores from anon;
revoke all on table app_private.facturas_saas_contadores from authenticated;

insert into app_private.facturas_saas_contadores (anio, ultimo_numero)
select
    substring(numero_factura from 5 for 4)::integer,
    max(right(numero_factura, 4)::integer)
from public.facturas_saas
where numero_factura ~ '^MSF-[0-9]{4}-[0-9]{4}$'
group by substring(numero_factura from 5 for 4)::integer
on conflict (anio)
do update set ultimo_numero = greatest(
    app_private.facturas_saas_contadores.ultimo_numero,
    excluded.ultimo_numero
);

create or replace function app_private.asignar_numero_factura_saas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anio integer;
    v_numero integer;
begin
    v_anio := extract(year from coalesce(new.fecha_emision, current_date))::integer;

    insert into app_private.facturas_saas_contadores (anio, ultimo_numero)
    values (v_anio, 1)
    on conflict (anio)
    do update set ultimo_numero = app_private.facturas_saas_contadores.ultimo_numero + 1
    returning ultimo_numero into v_numero;

    new.numero_factura := format('MSF-%s-%s', v_anio, lpad(v_numero::text, 4, '0'));
    return new;
end;
$$;

revoke all on function app_private.asignar_numero_factura_saas() from public;

drop trigger if exists trg_asignar_numero_factura_saas on public.facturas_saas;
create trigger trg_asignar_numero_factura_saas
before insert on public.facturas_saas
for each row execute function app_private.asignar_numero_factura_saas();

alter table public.facturas_saas enable row level security;

drop policy if exists "Michel Soft administra facturas SaaS" on public.facturas_saas;
create policy "Michel Soft administra facturas SaaS"
on public.facturas_saas
for all
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

grant select, insert, update on public.facturas_saas to authenticated;
grant select on public.planes_saas to authenticated;
grant select, insert, update on public.pagos_saas to authenticated;
grant select, insert, update on public.gimnasios_clientes to authenticated;

create or replace function public.crear_factura_saas(
    p_gimnasio_id uuid,
    p_fecha_emision date,
    p_fecha_vencimiento date,
    p_periodo_inicio date,
    p_periodo_fin date,
    p_plan text,
    p_cantidad numeric,
    p_precio_unitario numeric,
    p_itbis numeric,
    p_cliente_nombre text,
    p_cliente_propietario text default null,
    p_cliente_telefono text default null,
    p_cliente_email text default null,
    p_cliente_direccion text default null,
    p_observaciones text default null
)
returns public.facturas_saas
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_factura public.facturas_saas;
    v_subtotal numeric(12, 2);
    v_itbis numeric(12, 2);
begin
    if not app_private.is_super_admin_saas() then
        raise exception 'No autorizado';
    end if;
    if p_gimnasio_id is null or nullif(trim(p_cliente_nombre), '') is null then
        raise exception 'Cliente SaaS no valido';
    end if;
    if p_fecha_vencimiento < p_fecha_emision or p_periodo_fin < p_periodo_inicio then
        raise exception 'Rango de fechas no valido';
    end if;
    if coalesce(p_cantidad, 0) <= 0 or coalesce(p_precio_unitario, -1) < 0 or coalesce(p_itbis, -1) < 0 then
        raise exception 'Importes de factura no validos';
    end if;

    v_subtotal := round(p_cantidad * p_precio_unitario, 2);
    v_itbis := round(p_itbis, 2);

    insert into public.facturas_saas (
        gimnasio_id,
        numero_factura,
        fecha_emision,
        fecha_vencimiento,
        periodo_inicio,
        periodo_fin,
        servicio,
        plan,
        cantidad,
        precio_unitario,
        subtotal,
        itbis,
        total,
        estado,
        observaciones,
        cliente_nombre,
        cliente_propietario,
        cliente_telefono,
        cliente_email,
        cliente_direccion
    )
    values (
        p_gimnasio_id,
        '',
        p_fecha_emision,
        p_fecha_vencimiento,
        p_periodo_inicio,
        p_periodo_fin,
        'FitControl Pro',
        trim(p_plan),
        p_cantidad,
        p_precio_unitario,
        v_subtotal,
        v_itbis,
        v_subtotal + v_itbis,
        'pendiente',
        nullif(trim(p_observaciones), ''),
        trim(p_cliente_nombre),
        nullif(trim(p_cliente_propietario), ''),
        nullif(trim(p_cliente_telefono), ''),
        nullif(trim(p_cliente_email), ''),
        nullif(trim(p_cliente_direccion), '')
    )
    returning * into v_factura;

    return v_factura;
end;
$$;

create or replace function public.registrar_pago_factura_saas(
    p_factura_id uuid,
    p_metodo_pago text,
    p_referencia_pago text default null,
    p_fecha_pago timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_factura public.facturas_saas;
    v_pago_id uuid;
    v_plan_id uuid;
begin
    if not app_private.is_super_admin_saas() then
        raise exception 'No autorizado';
    end if;

    select *
    into v_factura
    from public.facturas_saas
    where id = p_factura_id
    for update;

    if v_factura.id is null then
        raise exception 'Factura SaaS no encontrada';
    end if;
    if v_factura.estado = 'pagada' then
        raise exception 'La factura ya esta pagada';
    end if;
    if v_factura.estado = 'anulada' then
        raise exception 'No se puede pagar una factura anulada';
    end if;

    select ps.id
    into v_plan_id
    from public.planes_saas ps
    where lower(trim(ps.nombre)) = lower(trim(v_factura.plan))
       or lower(trim(ps.codigo)) = lower(replace(trim(v_factura.plan), ' ', '_'))
    limit 1;

    select p.id
    into v_pago_id
    from public.pagos_saas p
    where p.gimnasio_id = v_factura.gimnasio_id
      and p.periodo_inicio = v_factura.periodo_inicio
      and p.periodo_fin = v_factura.periodo_fin
      and p.estado <> 'anulado'
    order by p.created_at desc
    limit 1
    for update;

    if v_pago_id is null then
        insert into public.pagos_saas (
            gimnasio_id,
            plan_id,
            periodo_inicio,
            periodo_fin,
            fecha_vencimiento,
            fecha_pago,
            monto,
            moneda,
            estado,
            metodo_pago,
            referencia_pago,
            registrado_por
        )
        values (
            v_factura.gimnasio_id,
            v_plan_id,
            v_factura.periodo_inicio,
            v_factura.periodo_fin,
            v_factura.fecha_vencimiento,
            coalesce(p_fecha_pago, now()),
            v_factura.total,
            'DOP',
            'pagado',
            trim(p_metodo_pago),
            nullif(trim(p_referencia_pago), ''),
            auth.uid()
        )
        returning id into v_pago_id;
    else
        update public.pagos_saas
        set plan_id = coalesce(v_plan_id, plan_id),
            fecha_pago = coalesce(p_fecha_pago, now()),
            monto = v_factura.total,
            estado = 'pagado',
            metodo_pago = trim(p_metodo_pago),
            referencia_pago = nullif(trim(p_referencia_pago), ''),
            registrado_por = auth.uid(),
            updated_at = now()
        where id = v_pago_id;
    end if;

    update public.facturas_saas
    set pago_saas_id = v_pago_id,
        estado = 'pagada',
        metodo_pago = trim(p_metodo_pago),
        referencia_pago = nullif(trim(p_referencia_pago), ''),
        updated_at = now()
    where id = v_factura.id;

    update public.gimnasios_clientes
    set estado = case when estado = 'suspendido' then 'activo' else estado end,
        estado_pago_saas = 'al_dia',
        fecha_vencimiento = greatest(coalesce(fecha_vencimiento, v_factura.periodo_fin), v_factura.periodo_fin),
        updated_at = now()
    where gimnasio_id = v_factura.gimnasio_id;

    return jsonb_build_object(
        'factura_id', v_factura.id,
        'pago_saas_id', v_pago_id,
        'gimnasio_id', v_factura.gimnasio_id
    );
end;
$$;

create or replace function public.actualizar_facturas_saas_vencidas()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_actualizadas integer := 0;
begin
    if not app_private.is_super_admin_saas() then
        raise exception 'No autorizado';
    end if;

    update public.facturas_saas
    set estado = 'vencida',
        updated_at = now()
    where estado = 'pendiente'
      and fecha_vencimiento < current_date;

    get diagnostics v_actualizadas = row_count;
    return v_actualizadas;
end;
$$;

revoke all on function public.crear_factura_saas(uuid, date, date, date, date, text, numeric, numeric, numeric, text, text, text, text, text, text) from public;
revoke all on function public.registrar_pago_factura_saas(uuid, text, text, timestamptz) from public;
revoke all on function public.actualizar_facturas_saas_vencidas() from public;
revoke all on function public.crear_factura_saas(uuid, date, date, date, date, text, numeric, numeric, numeric, text, text, text, text, text, text) from anon;
revoke all on function public.registrar_pago_factura_saas(uuid, text, text, timestamptz) from anon;
revoke all on function public.actualizar_facturas_saas_vencidas() from anon;
grant execute on function public.crear_factura_saas(uuid, date, date, date, date, text, numeric, numeric, numeric, text, text, text, text, text, text) to authenticated;
grant execute on function public.registrar_pago_factura_saas(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.actualizar_facturas_saas_vencidas() to authenticated;

insert into public.planes_saas (
    codigo,
    nombre,
    descripcion,
    precio_mensual,
    moneda,
    incluye_soporte,
    estado
)
select
    'cliente_1',
    'Cliente 1',
    'Plan comercial Cliente 1',
    coalesce((
        select max(gc.mensualidad)
        from public.gimnasios_clientes gc
        where lower(trim(gc.nombre_gimnasio)) = lower('Kilvio FIT')
    ), 0),
    'DOP',
    true,
    'activo'
where not exists (
    select 1
    from public.planes_saas ps
    where lower(trim(ps.codigo)) = 'cliente_1'
       or lower(trim(ps.nombre)) = lower('Cliente 1')
);

update public.gimnasios_clientes
set plan = 'Cliente 1',
    updated_at = now()
where lower(trim(nombre_gimnasio)) = lower('Kilvio FIT');

create or replace function public.resolver_ticket_soporte(p_ticket_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_gimnasio_id uuid;
    v_accesos_cerrados integer := 0;
begin
    if not app_private.is_super_admin_saas() then
        raise exception 'No autorizado';
    end if;

    update public.tickets_soporte
    set estado = 'resuelto',
        fecha_cierre = now(),
        updated_at = now()
    where id = p_ticket_id
    returning gimnasio_id into v_gimnasio_id;

    if v_gimnasio_id is null then
        raise exception 'Ticket de soporte no encontrado';
    end if;

    update public.soporte_accesos
    set estado = 'cerrado',
        fecha_fin = case
            when now() <= fecha_inicio then fecha_inicio + interval '1 microsecond'
            else least(fecha_fin, now())
        end,
        updated_at = now()
    where ticket_id = p_ticket_id
      and gimnasio_id = v_gimnasio_id
      and estado = 'activo';

    get diagnostics v_accesos_cerrados = row_count;

    return jsonb_build_object(
        'ticket_id', p_ticket_id,
        'gimnasio_id', v_gimnasio_id,
        'accesos_cerrados', v_accesos_cerrados
    );
end;
$$;

revoke all on function public.resolver_ticket_soporte(uuid) from public;
revoke all on function public.resolver_ticket_soporte(uuid) from anon;
grant execute on function public.resolver_ticket_soporte(uuid) to authenticated;

notify pgrst, 'reload schema';