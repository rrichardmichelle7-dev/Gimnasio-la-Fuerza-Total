-- Panel Michel Soft: plan Cliente 1 y resolución transaccional de tickets.
-- Ejecutar en Supabase SQL Editor después de los scripts SaaS existentes.
-- No concede acceso a datos operativos ni modifica Auth/login.

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

grant select, insert, update on public.gimnasios_clientes to authenticated;

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