-- 006_pos_payments_inventory_rpc.sql
-- POS, payments and automatic shift cashbox flow. Legacy abrir/cerrar caja functions are intentionally omitted.

create or replace function public.kilvio_turno_actual(p_momento timestamptz default now())
returns text
language sql
stable
set search_path = public
as $$
  select case
    when extract(hour from p_momento at time zone 'America/Santo_Domingo') between 6 and 13 then 'manana'
    when extract(hour from p_momento at time zone 'America/Santo_Domingo') between 14 and 21 then 'tarde'
    else 'noche'
  end;
$$;

create or replace function public.generar_numero_recibo(p_tipo text default 'POS')
returns text
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_gimnasio_id uuid := app_private.current_gimnasio_id();
  v_numero bigint;
begin
  if auth.uid() is null or v_gimnasio_id is null then
    raise exception 'Usuario no autenticado o sin gimnasio activo';
  end if;

  insert into public.contadores_recibos(gimnasio_id, tipo, ultimo_numero)
  values (v_gimnasio_id, upper(p_tipo), 1)
  on conflict (gimnasio_id, tipo) do update
    set ultimo_numero = public.contadores_recibos.ultimo_numero + 1,
        updated_at = now()
  returning ultimo_numero into v_numero;

  return upper(p_tipo) || '-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_numero::text, 6, '0');
end;
$$;

create or replace function public.activar_caja_turno_automatica(p_monto_inicial numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_perfil public.perfiles;
  v_turno text := public.kilvio_turno_actual(now());
  v_caja public.cajas_turno;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_perfil
  from public.perfiles
  where user_id = auth.uid()
    and estado = 'activo'
    and rol in ('administrador','recepcion')
    and gimnasio_id is not null
  limit 1;

  if v_perfil.id is null then
    raise exception 'Usuario sin permiso para activar caja';
  end if;

  select * into v_caja
  from public.cajas_turno
  where gimnasio_id = v_perfil.gimnasio_id
    and usuario_id = auth.uid()
    and fecha = current_date
    and turno = v_turno
  for update;

  if v_caja.id is null then
    insert into public.cajas_turno(gimnasio_id, usuario_id, turno, fecha, monto_inicial, estado)
    values (v_perfil.gimnasio_id, auth.uid(), v_turno, current_date, coalesce(p_monto_inicial, 0), 'abierta')
    returning * into v_caja;
  elsif v_caja.estado = 'cuadrada' then
    raise exception 'El turno actual ya fue cuadrado';
  end if;

  return jsonb_build_object('success', true, 'caja_turno_id', v_caja.id, 'turno', v_turno, 'estado', v_caja.estado);
end;
$$;

create or replace function public.registrar_pago(
  p_miembro_id bigint,
  p_monto numeric,
  p_mes text,
  p_metodo_pago text default 'efectivo',
  p_referencia_pago text default null,
  p_banco text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_gimnasio_id uuid := app_private.current_gimnasio_id();
  v_caja_id bigint;
  v_pago_id bigint;
  v_recibo text;
begin
  if auth.uid() is null or v_gimnasio_id is null then
    raise exception 'Usuario no autenticado o sin gimnasio activo';
  end if;

  if not exists (select 1 from public."Miembros" m where m.id = p_miembro_id and m.gimnasio_id = v_gimnasio_id) then
    raise exception 'Miembro no pertenece al gimnasio activo';
  end if;

  select (public.activar_caja_turno_automatica()->>'caja_turno_id')::bigint into v_caja_id;
  v_recibo := public.generar_numero_recibo('PAGO');

  insert into public.pagos(gimnasio_id, miembro_id, monto, mes, metodo_pago, referencia_pago, banco, numero_recibo, usuario_registro, caja_turno_id)
  values (v_gimnasio_id, p_miembro_id, p_monto, p_mes, p_metodo_pago, p_referencia_pago, p_banco, v_recibo, auth.uid()::text, v_caja_id)
  returning id into v_pago_id;

  return jsonb_build_object('success', true, 'pago_id', v_pago_id, 'numero_recibo', v_recibo, 'caja_turno_id', v_caja_id);
end;
$$;

create or replace function public.confirmar_venta_pos(
  p_items jsonb,
  p_metodo_pago text default 'efectivo',
  p_referencia_pago text default null,
  p_monto_recibido numeric default null,
  p_banco text default null,
  p_miembro_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_gimnasio_id uuid := app_private.current_gimnasio_id();
  v_caja_id bigint;
  v_venta_id bigint;
  v_recibo text;
  v_item jsonb;
  v_producto public.productos;
  v_subtotal numeric := 0;
  v_total numeric := 0;
begin
  if auth.uid() is null or v_gimnasio_id is null then
    raise exception 'Usuario no autenticado o sin gimnasio activo';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  if p_miembro_id is not null and not exists (select 1 from public."Miembros" where id = p_miembro_id and gimnasio_id = v_gimnasio_id) then
    raise exception 'Miembro no pertenece al gimnasio activo';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_producto from public.productos
    where id = (v_item->>'producto_id')::bigint and gimnasio_id = v_gimnasio_id and activo = true
    for update;

    if v_producto.id is null then
      raise exception 'Producto no encontrado: %', v_item->>'producto_id';
    end if;
    if v_producto.stock < (v_item->>'cantidad')::integer then
      raise exception 'Stock insuficiente para %', v_producto.nombre;
    end if;
    v_subtotal := v_subtotal + (v_producto.precio * (v_item->>'cantidad')::integer);
  end loop;

  v_total := v_subtotal;
  select (public.activar_caja_turno_automatica()->>'caja_turno_id')::bigint into v_caja_id;
  v_recibo := public.generar_numero_recibo('POS');

  insert into public.ventas(gimnasio_id, miembro_id, subtotal, total, metodo_pago, referencia_pago, banco, monto_recibido, cambio, numero_recibo, caja_turno_id, usuario_id)
  values (v_gimnasio_id, p_miembro_id, v_subtotal, v_total, p_metodo_pago, nullif(trim(coalesce(p_referencia_pago, '')), ''), p_banco, p_monto_recibido, greatest(coalesce(p_monto_recibido, v_total) - v_total, 0), v_recibo, v_caja_id, auth.uid())
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_producto from public.productos
    where id = (v_item->>'producto_id')::bigint and gimnasio_id = v_gimnasio_id
    for update;

    insert into public.venta_detalles(gimnasio_id, venta_id, producto_id, producto_nombre, cantidad, precio_unitario, costo_unitario, total)
    values (v_gimnasio_id, v_venta_id, v_producto.id, v_producto.nombre, (v_item->>'cantidad')::integer, v_producto.precio, v_producto.costo, v_producto.precio * (v_item->>'cantidad')::integer);

    insert into public.movimientos_inventario(gimnasio_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, referencia_tipo, referencia_id, motivo, usuario_id)
    values (v_gimnasio_id, v_producto.id, 'salida', (v_item->>'cantidad')::integer, v_producto.stock, v_producto.stock - (v_item->>'cantidad')::integer, 'venta', v_venta_id, 'Venta POS', auth.uid());

    update public.productos set stock = stock - (v_item->>'cantidad')::integer, updated_at = now() where id = v_producto.id;
  end loop;

  insert into public.facturas(gimnasio_id, venta_id, numero, tipo, subtotal, total)
  values (v_gimnasio_id, v_venta_id, v_recibo, 'pos', v_subtotal, v_total);

  return jsonb_build_object('success', true, 'venta_id', v_venta_id, 'numero_recibo', v_recibo, 'total', v_total, 'caja_turno_id', v_caja_id);
end;
$$;

create or replace function public.anular_venta_pos(p_venta_id bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_admin_gimnasio uuid := app_private.current_admin_gimnasio_id();
  v_venta public.ventas;
  v_det public.venta_detalles;
  v_stock integer;
begin
  if auth.uid() is null or v_admin_gimnasio is null then
    raise exception 'Solo administradores activos pueden anular ventas';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id and gimnasio_id = v_admin_gimnasio for update;
  if v_venta.id is null then raise exception 'Venta no encontrada'; end if;
  if v_venta.estado = 'anulada' then raise exception 'La venta ya está anulada'; end if;

  update public.ventas set estado = 'anulada', motivo_anulacion = p_motivo, anulada_por = auth.uid(), anulada_at = now(), updated_at = now() where id = p_venta_id;
  update public.facturas set estado = 'anulada', updated_at = now() where venta_id = p_venta_id and gimnasio_id = v_admin_gimnasio;

  for v_det in select * from public.venta_detalles where venta_id = p_venta_id loop
    select stock into v_stock from public.productos where id = v_det.producto_id and gimnasio_id = v_admin_gimnasio for update;
    update public.productos set stock = stock + v_det.cantidad, updated_at = now() where id = v_det.producto_id;
    insert into public.movimientos_inventario(gimnasio_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, referencia_tipo, referencia_id, motivo, usuario_id)
    values (v_admin_gimnasio, v_det.producto_id, 'anulacion', v_det.cantidad, v_stock, v_stock + v_det.cantidad, 'venta_anulada', p_venta_id, p_motivo, auth.uid());
  end loop;

  return jsonb_build_object('success', true, 'venta_id', p_venta_id, 'estado', 'anulada');
end;
$$;

create or replace function public.guardar_cuadre_caja_turno(
  p_caja_turno_id bigint,
  p_total_contado numeric,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_gimnasio_id uuid := app_private.current_gimnasio_id();
  v_caja public.cajas_turno;
  v_sistema numeric;
begin
  if auth.uid() is null or v_gimnasio_id is null then raise exception 'Usuario no autenticado'; end if;

  select * into v_caja from public.cajas_turno where id = p_caja_turno_id and gimnasio_id = v_gimnasio_id and usuario_id = auth.uid() for update;
  if v_caja.id is null then raise exception 'Caja no encontrada para el usuario actual'; end if;
  if v_caja.estado = 'cuadrada' then raise exception 'La caja ya fue cuadrada'; end if;

  select coalesce(sum(total), 0) into v_sistema from public.ventas where caja_turno_id = p_caja_turno_id and estado = 'confirmada';
  v_sistema := v_sistema + coalesce((select sum(monto) from public.pagos where caja_turno_id = p_caja_turno_id and estado = 'pagado'), 0);

  update public.cajas_turno
  set total_sistema = v_sistema,
      total_contado = p_total_contado,
      diferencia = p_total_contado - v_sistema,
      estado = 'cuadrada',
      hora_fin = now(),
      hora_cuadre = now(),
      fecha_cuadre = now(),
      cuadrado_por = auth.uid(),
      observaciones = p_observaciones,
      updated_at = now()
  where id = p_caja_turno_id;

  return jsonb_build_object('success', true, 'caja_turno_id', p_caja_turno_id, 'total_sistema', v_sistema, 'diferencia', p_total_contado - v_sistema);
end;
$$;

create or replace function public.reabrir_cuadre_caja_turno(p_caja_turno_id bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_admin_gimnasio uuid := app_private.current_admin_gimnasio_id();
begin
  if auth.uid() is null or v_admin_gimnasio is null then raise exception 'Solo administradores activos pueden reabrir cuadre'; end if;

  update public.cajas_turno
  set estado = 'reabierta', reabierta_por = auth.uid(), motivo_reapertura = p_motivo, updated_at = now()
  where id = p_caja_turno_id and gimnasio_id = v_admin_gimnasio;

  if not found then raise exception 'Caja no encontrada'; end if;
  return jsonb_build_object('success', true, 'caja_turno_id', p_caja_turno_id, 'estado', 'reabierta');
end;
$$;

revoke all on function public.kilvio_turno_actual(timestamptz) from public;
revoke all on function public.generar_numero_recibo(text) from public;
revoke all on function public.activar_caja_turno_automatica(numeric) from public;
revoke all on function public.registrar_pago(bigint, numeric, text, text, text, text) from public;
revoke all on function public.confirmar_venta_pos(jsonb, text, text, numeric, text, bigint) from public;
revoke all on function public.anular_venta_pos(bigint, text) from public;
revoke all on function public.guardar_cuadre_caja_turno(bigint, numeric, text) from public;
revoke all on function public.reabrir_cuadre_caja_turno(bigint, text) from public;

grant execute on function public.kilvio_turno_actual(timestamptz) to authenticated;
grant execute on function public.generar_numero_recibo(text) to authenticated;
grant execute on function public.activar_caja_turno_automatica(numeric) to authenticated;
grant execute on function public.registrar_pago(bigint, numeric, text, text, text, text) to authenticated;
grant execute on function public.confirmar_venta_pos(jsonb, text, text, numeric, text, bigint) to authenticated;
grant execute on function public.anular_venta_pos(bigint, text) to authenticated;
grant execute on function public.guardar_cuadre_caja_turno(bigint, numeric, text) to authenticated;
grant execute on function public.reabrir_cuadre_caja_turno(bigint, text) to authenticated;
