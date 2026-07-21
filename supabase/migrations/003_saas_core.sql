-- 003_saas_core.sql
-- Michel Soft SaaS client registry and authorized support base.

create table if not exists public.gimnasios_clientes (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null unique references public.gimnasios(id) on delete restrict,
  nombre_gimnasio text not null,
  nombre_comercial_gimnasio text,
  propietario text,
  propietario_telefono text,
  propietario_whatsapp text,
  telefono text,
  telefono_gimnasio text,
  contacto_principal_telefono text,
  email text,
  plan text not null default 'Cliente 1',
  estado text not null default 'activo' check (estado in ('activo','inactivo','suspendido','cancelado')),
  fecha_inicio date,
  fecha_vencimiento date,
  mensualidad numeric(12,2) not null default 0,
  estado_pago_saas text not null default 'pendiente' check (estado_pago_saas in ('pendiente','pagado','vencido','exonerado')),
  estado_tecnico text not null default 'estable' check (estado_tecnico in ('estable','revision','incidencia','bloqueado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.soporte_accesos (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios_clientes(gimnasio_id) on delete cascade,
  ticket_id uuid,
  autorizado_por uuid references auth.users(id) on delete set null,
  tecnico_id uuid references auth.users(id) on delete set null,
  modulos text[] not null default array[]::text[],
  motivo text,
  estado text not null default 'activo' check (estado in ('activo','cerrado','revocado','vencido')),
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger trg_gimnasios_clientes_updated_at before update on public.gimnasios_clientes for each row execute function public.set_updated_at();
create or replace trigger trg_soporte_accesos_updated_at before update on public.soporte_accesos for each row execute function public.set_updated_at();

create index if not exists idx_gimnasios_clientes_estado on public.gimnasios_clientes(estado, estado_pago_saas);
create index if not exists idx_soporte_accesos_gimnasio_estado on public.soporte_accesos(gimnasio_id, estado);

create or replace function app_private.cliente_saas_activo(p_gimnasio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1 from public.gimnasios_clientes gc
    where gc.gimnasio_id = p_gimnasio_id and gc.estado = 'activo'
  );
$$;

create or replace function app_private.soporte_activo_para_gimnasio(p_gimnasio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1 from public.soporte_accesos sa
    where sa.gimnasio_id = p_gimnasio_id
      and sa.estado = 'activo'
      and (sa.fecha_fin is null or sa.fecha_fin > now())
  );
$$;

revoke all on function app_private.cliente_saas_activo(uuid) from public;
revoke all on function app_private.soporte_activo_para_gimnasio(uuid) from public;
