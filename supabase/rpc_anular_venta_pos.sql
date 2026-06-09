-- Kilvio FIT - RPC para anular ventas POS
-- No borra ventas, detalles ni facturas. Devuelve stock y deja auditoria en movimientos_inventario.

create or replace function public.anular_venta_pos(
    p_venta_id bigint,
    p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_perfil record;
    v_gimnasio_id uuid;
    v_venta record;
    v_detalle record;
    v_stock_posterior int4;
    v_detalles_count int4;
begin
    if v_user_id is null then
        raise exception 'Usuario no autenticado';
    end if;

    select id, gimnasio_id, rol, estado
    into v_perfil
    from public.perfiles
    where user_id = v_user_id
      and lower(coalesce(estado, '')) = 'activo'
    limit 1;

    if not found or v_perfil.gimnasio_id is null then
        raise exception 'Perfil no valido';
    end if;

    if v_perfil.rol <> 'administrador' then
        raise exception 'Solo administrador puede anular ventas';
    end if;

    if nullif(trim(coalesce(p_motivo, '')), '') is null then
        raise exception 'El motivo de anulacion es obligatorio';
    end if;

    v_gimnasio_id := v_perfil.gimnasio_id;

    select *
    into v_venta
    from public.ventas
    where id = p_venta_id
    for update;

    if not found then
        raise exception 'Venta no encontrada';
    end if;

    if v_venta.gimnasio_id <> v_gimnasio_id then
        raise exception 'La venta no pertenece al gimnasio del usuario';
    end if;

    if lower(coalesce(v_venta.estado, 'confirmada')) = 'anulada' then
        raise exception 'La venta ya esta anulada';
    end if;

    select count(*)
    into v_detalles_count
    from public.venta_detalles
    where venta_id = p_venta_id
      and gimnasio_id = v_gimnasio_id;

    if coalesce(v_detalles_count, 0) = 0 then
        raise exception 'La venta no tiene detalles';
    end if;

    for v_detalle in
        select vd.producto_id, vd.cantidad
        from public.venta_detalles vd
        where vd.venta_id = p_venta_id
          and vd.gimnasio_id = v_gimnasio_id
        order by vd.id
    loop
        update public.productos
        set stock = coalesce(stock, 0) + v_detalle.cantidad,
            updated_at = now()
        where id = v_detalle.producto_id
          and gimnasio_id = v_gimnasio_id
        returning stock into v_stock_posterior;

        if v_stock_posterior is null then
            raise exception 'No se pudo devolver stock para producto %', v_detalle.producto_id;
        end if;

        insert into public.movimientos_inventario (
            gimnasio_id,
            producto_id,
            tipo,
            cantidad,
            stock_posterior,
            referencia_tipo,
            referencia_id,
            observacion,
            usuario_registro
        )
        values (
            v_gimnasio_id,
            v_detalle.producto_id,
            'anulacion',
            v_detalle.cantidad,
            v_stock_posterior,
            'venta',
            p_venta_id,
            'Anulacion POS: ' || trim(p_motivo),
            v_user_id::text
        );
    end loop;

    update public.ventas
    set estado = 'anulada',
        anulada_at = now(),
        anulada_por = v_user_id::text,
        motivo_anulacion = trim(p_motivo)
    where id = p_venta_id
      and gimnasio_id = v_gimnasio_id;

    update public.facturas
    set estado = 'anulada',
        venta_estado = 'anulada',
        anulada_at = now()
    where tipo = 'venta_producto'
      and referencia_id = p_venta_id
      and gimnasio_id = v_gimnasio_id;

    return jsonb_build_object(
        'venta_id', p_venta_id,
        'estado', 'anulada',
        'mensaje', 'Venta anulada correctamente'
    );
end;
$$;

revoke execute on function public.anular_venta_pos(bigint, text) from public;
revoke execute on function public.anular_venta_pos(bigint, text) from anon;
grant execute on function public.anular_venta_pos(bigint, text) to authenticated;
