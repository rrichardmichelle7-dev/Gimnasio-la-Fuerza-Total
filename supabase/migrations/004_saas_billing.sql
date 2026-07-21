-- 004_saas_billing.sql
-- SaaS plans, payments and vencimiento helpers.

create table if not exists public.planes_saas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  precio_mensual numeric(12,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagos_saas (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios_clientes(gimnasio_id) on delete restrict,
  plan text not null,
  periodo text not null,
  monto numeric(12,2) not null check (monto >= 0),
  fecha_pago timestamptz,
  metodo_pago text,
  referencia text,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','vencido','anulado','exonerado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gimnasio_id, periodo)
);

create table if not exists public.alertas_vencimiento_saas (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios_clientes(gimnasio_id) on delete cascade,
  tipo text not null check (tipo in ('proximo_vencimiento','vencido','suspension')),
  mensaje text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviada','descartada')),
  fecha_alerta timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.planes_saas(nombre, descripcion, precio_mensual, activo)
values ('Cliente 1', 'Plan base normalizado para clientes SaaS.', 0, true)
on conflict (nombre) do update set activo = true, updated_at = now();

create or replace trigger trg_planes_saas_updated_at before update on public.planes_saas for each row execute function public.set_updated_at();
create or replace trigger trg_pagos_saas_updated_at before update on public.pagos_saas for each row execute function public.set_updated_at();
create or replace trigger trg_alertas_vencimiento_saas_updated_at before update on public.alertas_vencimiento_saas for each row execute function public.set_updated_at();

create index if not exists idx_pagos_saas_gimnasio_estado on public.pagos_saas(gimnasio_id, estado);
create index if not exists idx_alertas_vencimiento_saas_estado on public.alertas_vencimiento_saas(gimnasio_id, estado);

create or replace function public.marcar_pago_saas_pagado(
  p_pago_id uuid,
  p_metodo_pago text,
  p_referencia text default null,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_pago public.pagos_saas;
begin
  if auth.uid() is null or not app_private.is_super_admin_saas() then
    raise exception 'Solo super_admin_saas activo puede marcar pagos SaaS';
  end if;

  select * into v_pago from public.pagos_saas where id = p_pago_id for update;
  if v_pago.id is null then
    raise exception 'Pago SaaS no encontrado';
  end if;

  update public.pagos_saas
  set estado = 'pagado', fecha_pago = now(), metodo_pago = p_metodo_pago,
      referencia = p_referencia, notas = coalesce(p_notas, notas), updated_at = now()
  where id = p_pago_id;

  update public.gimnasios_clientes
  set estado_pago_saas = 'pagado', updated_at = now()
  where gimnasio_id = v_pago.gimnasio_id;

  return jsonb_build_object('success', true, 'pago_id', p_pago_id);
end;
$$;

revoke all on function public.marcar_pago_saas_pagado(uuid, text, text, text) from public;
grant execute on function public.marcar_pago_saas_pagado(uuid, text, text, text) to authenticated;
