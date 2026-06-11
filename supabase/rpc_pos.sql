-- Kilvio FIT - RPC POS transaccional con ITBIS y pago efectivo.
-- Ejecutar en Supabase SQL Editor. No desactiva RLS y no usa service_role.

alter table public.ventas
add column if not exists subtotal numeric(12,2),
add column if not exists itbis numeric(12,2),
add column if not exists monto_recibido numeric(12,2),
add column if not exists devuelta numeric(12,2);

alter table public.facturas
add column if not exists subtotal numeric(12,2),
add column if not exists itbis numeric(12,2),
add column if not exists monto_recibido numeric(12,2),
add column if not exists devuelta numeric(12,2);

drop function if exists public.confirmar_venta_pos(jsonb, text, text);

create or replace function public.confirmar_venta_pos(
    p_items jsonb,
    p_metodo_pago text,
    p_referencia_pago text default null,
    p_monto_recibido numeric default null
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
    v_numero_recibo text;
    v_ultimo bigint;
    v_venta_id bigint;
    v_factura_id bigint;
    v_total numeric(12,2) := 0;
    v_subtotal numeric(12,2) := 0;
    v_itbis numeric(12,2) := 0;
    v_monto_recibido numeric(12,2) := 0;
    v_devuelta numeric(12,2) := 0;
    v_item record;
    v_producto public.productos%rowtype;
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

    if v_perfil.rol not in ('administrador', 'recepcion') then
        raise exception 'Sin permiso para vender';
    end if;

    v_gimnasio_id := v_perfil.gimnasio_id;

    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'El carrito esta vacio';
    end if;

    if p_metodo_pago not in ('Efectivo', 'Tarjeta') then
        raise exception 'Metodo de pago invalido para POS';
    end if;

    if p_metodo_pago = 'Tarjeta' and nullif(trim(coalesce(p_referencia_pago, '')), '') is null then
        raise exception 'La referencia es obligatoria para tarjeta';
    end if;

    for v_item in
        select producto_id, sum(cantidad)::int4 as cantidad
        from jsonb_to_recordset(p_items) as item(producto_id bigint, cantidad int4)
        group by producto_id
        order by producto_id
    loop
        if v_item.producto_id is null then
            raise exception 'Producto invalido en el carrito';
        end if;

        if v_item.cantidad is null or v_item.cantidad <= 0 then
            raise exception 'Cantidad invalida para producto %', v_item.producto_id;
        end if;

        select *
        into v_producto
        from public.productos
        where id = v_item.producto_id
        for update;

        if not found or v_producto.gimnasio_id <> v_gimnasio_id then
            raise exception 'Producto no pertenece al gimnasio';
        end if;

        if lower(coalesce(v_producto.estado, '')) <> 'activo' then
            raise exception 'Producto inactivo: %', v_producto.nombre;
        end if;

        if coalesce(v_producto.stock, 0) < v_item.cantidad then
            raise exception 'Stock insuficiente para %', v_producto.nombre;
        end if;

        v_total := v_total + (coalesce(v_producto.precio, 0) * v_item.cantidad);
    end loop;

    v_total := round(v_total, 2);
    v_subtotal := round(v_total / 1.18, 2);
    v_itbis := round(v_total - v_subtotal, 2);

    if v_total <= 0 then
        raise exception 'Total de venta invalido';
    end if;

    if p_metodo_pago = 'Efectivo' then
        v_monto_recibido := round(coalesce(p_monto_recibido, 0), 2);

        if v_monto_recibido < v_total then
            raise exception 'Monto recibido insuficiente';
        end if;

        v_devuelta := round(v_monto_recibido - v_total, 2);
    else
        v_monto_recibido := 0;
        v_devuelta := 0;
    end if;

    insert into public.contadores_recibos (gimnasio_id, tipo, ultimo_numero)
    values (v_gimnasio_id, 'venta', 1)
    on conflict (gimnasio_id, tipo)
    do update set
        ultimo_numero = public.contadores_recibos.ultimo_numero + 1,
        updated_at = now()
    returning ultimo_numero into v_ultimo;

    v_numero_recibo := 'VEN-' || lpad(v_ultimo::text, 6, '0');

    insert into public.ventas (
        gimnasio_id, fecha, metodo_pago, referencia_pago,
        subtotal, itbis, total, monto_recibido, devuelta,
        numero_recibo, usuario_registro, estado
    )
    values (
        v_gimnasio_id, current_date, p_metodo_pago,
        nullif(trim(coalesce(p_referencia_pago, '')), ''),
        v_subtotal, v_itbis, v_total, v_monto_recibido, v_devuelta,
        v_numero_recibo, v_user_id::text, 'confirmada'
    )
    returning id into v_venta_id;

    for v_item in
        select producto_id, sum(cantidad)::int4 as cantidad
        from jsonb_to_recordset(p_items) as item(producto_id bigint, cantidad int4)
        group by producto_id
        order by producto_id
    loop
        select *
        into v_producto
        from public.productos
        where id = v_item.producto_id
          and gimnasio_id = v_gimnasio_id
        for update;

        if not found then
            raise exception 'Producto no pertenece al gimnasio';
        end if;

        if coalesce(v_producto.stock, 0) < v_item.cantidad then
            raise exception 'Stock insuficiente para %', v_producto.nombre;
        end if;

        insert into public.venta_detalles (
            gimnasio_id, venta_id, producto_id, cantidad, precio_unitario, costo_unitario
        )
        values (
            v_gimnasio_id, v_venta_id, v_producto.id, v_item.cantidad,
            coalesce(v_producto.precio, 0), coalesce(v_producto.costo, 0)
        );

        update public.productos
        set stock = stock - v_item.cantidad,
            updated_at = now()
        where id = v_producto.id
          and gimnasio_id = v_gimnasio_id;

        insert into public.movimientos_inventario (
            gimnasio_id, producto_id, tipo, cantidad, stock_posterior,
            referencia_tipo, referencia_id, observacion, usuario_registro
        )
        values (
            v_gimnasio_id, v_producto.id, 'salida', v_item.cantidad,
            v_producto.stock - v_item.cantidad, 'venta', v_venta_id,
            'Venta POS ' || v_numero_recibo, v_user_id::text
        );
    end loop;

    insert into public.facturas (
        gimnasio_id, tipo, referencia_id, numero_recibo, fecha, cliente,
        concepto, metodo_pago, referencia_pago,
        subtotal, itbis, total, monto_recibido, devuelta,
        usuario_registro, estado, venta_estado
    )
    values (
        v_gimnasio_id, 'venta_producto', v_venta_id, v_numero_recibo, current_date,
        'Cliente General', 'venta de productos', p_metodo_pago,
        nullif(trim(coalesce(p_referencia_pago, '')), ''),
        v_subtotal, v_itbis, v_total, v_monto_recibido, v_devuelta,
        v_user_id::text, 'emitida', 'confirmada'
    )
    returning id into v_factura_id;

    return jsonb_build_object(
        'venta_id', v_venta_id,
        'factura_id', v_factura_id,
        'numero_recibo', v_numero_recibo,
        'subtotal', v_subtotal,
        'itbis', v_itbis,
        'total', v_total,
        'monto_recibido', v_monto_recibido,
        'devuelta', v_devuelta
    );
end;
$$;

revoke execute on function public.confirmar_venta_pos(jsonb, text, text, numeric) from public;
revoke execute on function public.confirmar_venta_pos(jsonb, text, text, numeric) from anon;
grant execute on function public.confirmar_venta_pos(jsonb, text, text, numeric) to authenticated;

notify pgrst, 'reload schema';
