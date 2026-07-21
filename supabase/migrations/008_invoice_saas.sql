-- 008_invoice_saas.sql
-- SaaS invoice module. Does not define support-ticket functions.

create table if not exists public.facturas_saas (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios_clientes(gimnasio_id) on delete restrict,
  numero text not null,
  periodo text not null,
  concepto text not null default 'Mensualidad SaaS',
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  impuestos numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagada','vencida','anulada')),
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  fecha_pago timestamptz,
  metodo_pago text,
  referencia_pago text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gimnasio_id, periodo),
  unique (numero)
);

create table if not exists public.contadores_facturas_saas (
  anio integer not null,
  ultimo_numero bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (anio)
);

create index if not exists idx_facturas_saas_gimnasio_estado on public.facturas_saas(gimnasio_id, estado);
create index if not exists idx_facturas_saas_periodo on public.facturas_saas(periodo);

create or replace trigger trg_facturas_saas_updated_at before update on public.facturas_saas for each row execute function public.set_updated_at();

create or replace function public.generar_numero_factura_saas()
returns text
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_anio integer := extract(year from now())::integer;
  v_numero bigint;
begin
  if auth.uid() is null or not app_private.is_super_admin_saas() then
    raise exception 'Solo super_admin_saas activo puede generar facturas SaaS';
  end if;

  insert into public.contadores_facturas_saas(anio, ultimo_numero)
  values (v_anio, 1)
  on conflict (anio) do update
    set ultimo_numero = public.contadores_facturas_saas.ultimo_numero + 1,
        updated_at = now()
  returning ultimo_numero into v_numero;

  return 'SAAS-' || v_anio || '-' || lpad(v_numero::text, 6, '0');
end;
$$;

create or replace function public.crear_factura_saas(
  p_gimnasio_id uuid,
  p_periodo text,
  p_concepto text default 'Mensualidad SaaS',
  p_total numeric default null,
  p_fecha_vencimiento date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_cliente public.gimnasios_clientes;
  v_numero text;
  v_total numeric;
  v_factura_id uuid;
begin
  if auth.uid() is null or not app_private.is_super_admin_saas() then
    raise exception 'Solo super_admin_saas activo puede crear facturas SaaS';
  end if;

  select * into v_cliente from public.gimnasios_clientes where gimnasio_id = p_gimnasio_id;
  if v_cliente.id is null then raise exception 'Cliente SaaS no encontrado'; end if;

  v_numero := public.generar_numero_factura_saas();
  v_total := coalesce(p_total, v_cliente.mensualidad, 0);

  insert into public.facturas_saas(gimnasio_id, numero, periodo, concepto, subtotal, total, fecha_vencimiento)
  values (p_gimnasio_id, v_numero, p_periodo, p_concepto, v_total, v_total, p_fecha_vencimiento)
  on conflict (gimnasio_id, periodo) do update
    set concepto = excluded.concepto,
        subtotal = excluded.subtotal,
        total = excluded.total,
        fecha_vencimiento = excluded.fecha_vencimiento,
        updated_at = now()
  returning id into v_factura_id;

  return jsonb_build_object('success', true, 'factura_id', v_factura_id, 'numero', v_numero);
end;
$$;

create or replace function public.registrar_pago_factura_saas(
  p_factura_id uuid,
  p_metodo_pago text,
  p_referencia_pago text default null,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_factura public.facturas_saas;
begin
  if auth.uid() is null or not app_private.is_super_admin_saas() then
    raise exception 'Solo super_admin_saas activo puede registrar pagos SaaS';
  end if;

  select * into v_factura from public.facturas_saas where id = p_factura_id for update;
  if v_factura.id is null then raise exception 'Factura SaaS no encontrada'; end if;

  update public.facturas_saas
  set estado = 'pagada', fecha_pago = now(), metodo_pago = p_metodo_pago,
      referencia_pago = p_referencia_pago, notas = coalesce(p_notas, notas), updated_at = now()
  where id = p_factura_id;

  update public.gimnasios_clientes
  set estado_pago_saas = 'pagado', updated_at = now()
  where gimnasio_id = v_factura.gimnasio_id;

  insert into public.pagos_saas(gimnasio_id, plan, periodo, monto, fecha_pago, metodo_pago, referencia, estado, notas)
  select gc.gimnasio_id, gc.plan, v_factura.periodo, v_factura.total, now(), p_metodo_pago, p_referencia_pago, 'pagado', p_notas
  from public.gimnasios_clientes gc
  where gc.gimnasio_id = v_factura.gimnasio_id
  on conflict (gimnasio_id, periodo) do update
    set estado = 'pagado', fecha_pago = now(), metodo_pago = excluded.metodo_pago,
        referencia = excluded.referencia, notas = excluded.notas, updated_at = now();

  return jsonb_build_object('success', true, 'factura_id', p_factura_id, 'estado', 'pagada');
end;
$$;

create or replace function public.actualizar_facturas_saas_vencidas()
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not app_private.is_super_admin_saas() then
    raise exception 'Solo super_admin_saas activo puede actualizar facturas vencidas';
  end if;

  update public.facturas_saas
  set estado = 'vencida', updated_at = now()
  where estado = 'pendiente'
    and fecha_vencimiento is not null
    and fecha_vencimiento < current_date;

  get diagnostics v_count = row_count;

  update public.gimnasios_clientes gc
  set estado_pago_saas = 'vencido', updated_at = now()
  where exists (
    select 1 from public.facturas_saas fs
    where fs.gimnasio_id = gc.gimnasio_id and fs.estado = 'vencida'
  );

  return jsonb_build_object('success', true, 'facturas_vencidas', v_count);
end;
$$;

alter table public.facturas_saas enable row level security;
alter table public.contadores_facturas_saas enable row level security;

drop policy if exists facturas_saas_super_admin on public.facturas_saas;
create policy facturas_saas_super_admin on public.facturas_saas
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

drop policy if exists contadores_facturas_saas_super_admin on public.contadores_facturas_saas;
create policy contadores_facturas_saas_super_admin on public.contadores_facturas_saas
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

revoke all on function public.generar_numero_factura_saas() from public;
revoke all on function public.crear_factura_saas(uuid, text, text, numeric, date) from public;
revoke all on function public.registrar_pago_factura_saas(uuid, text, text, text) from public;
revoke all on function public.actualizar_facturas_saas_vencidas() from public;

grant execute on function public.generar_numero_factura_saas() to authenticated;
grant execute on function public.crear_factura_saas(uuid, text, text, numeric, date) to authenticated;
grant execute on function public.registrar_pago_factura_saas(uuid, text, text, text) to authenticated;
grant execute on function public.actualizar_facturas_saas_vencidas() to authenticated;
