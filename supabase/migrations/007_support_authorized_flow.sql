-- 007_support_authorized_flow.sql
-- SaaS support tickets and authorized access flow. Single resolver_ticket_soporte definition.
-- Private operational data is visible to super_admin_saas only during an active module-scoped support window.

create table if not exists public.tickets_soporte (
  id uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios_clientes(gimnasio_id) on delete cascade,
  creado_por uuid references auth.users(id) on delete set null,
  titulo text not null,
  descripcion text,
  categoria text not null default 'general',
  prioridad text not null default 'media',
  estado text not null default 'abierto',
  asignado_a uuid references auth.users(id) on delete set null,
  soporte_acceso_id uuid,
  fecha_cierre timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets_soporte
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists categoria text not null default 'general',
  add column if not exists fecha_cierre timestamptz;

alter table public.tickets_soporte drop constraint if exists tickets_soporte_categoria_check;
alter table public.tickets_soporte add constraint tickets_soporte_categoria_check
  check (categoria in ('general','billing','tecnico','capacitacion','dashboard','miembros','asistencia','pagos','pos','inventario','caja','facturas','usuarios','otro'));

alter table public.tickets_soporte drop constraint if exists tickets_soporte_prioridad_check;
alter table public.tickets_soporte add constraint tickets_soporte_prioridad_check
  check (prioridad in ('baja','media','alta','critica','urgente'));

alter table public.tickets_soporte drop constraint if exists tickets_soporte_estado_check;
alter table public.tickets_soporte add constraint tickets_soporte_estado_check
  check (estado in ('abierto','en_proceso','pendiente_cliente','resuelto','cerrado'));

alter table public.soporte_accesos drop constraint if exists soporte_accesos_ticket_fk;
alter table public.soporte_accesos add constraint soporte_accesos_ticket_fk foreign key (ticket_id) references public.tickets_soporte(id) on delete set null;
alter table public.tickets_soporte drop constraint if exists tickets_soporte_soporte_acceso_fk;
alter table public.tickets_soporte add constraint tickets_soporte_soporte_acceso_fk foreign key (soporte_acceso_id) references public.soporte_accesos(id) on delete set null;

create index if not exists idx_tickets_soporte_gimnasio_estado on public.tickets_soporte(gimnasio_id, estado);
create index if not exists idx_tickets_soporte_created_at on public.tickets_soporte(created_at desc);
create index if not exists idx_soporte_accesos_ticket on public.soporte_accesos(ticket_id, estado, fecha_inicio, fecha_fin);

create or replace trigger trg_tickets_soporte_updated_at before update on public.tickets_soporte for each row execute function public.set_updated_at();

create or replace function app_private.soporte_activo_para_modulo(p_gimnasio_id uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.soporte_accesos sa
    left join public.tickets_soporte ts on ts.id = sa.ticket_id
    where sa.gimnasio_id = p_gimnasio_id
      and sa.estado = 'activo'
      and now() >= sa.fecha_inicio
      and (sa.fecha_fin is null or sa.fecha_fin > now())
      and coalesce(ts.estado, 'abierto') not in ('resuelto','cerrado')
      and (
        p_modulo = any(sa.modulos)
        or ts.categoria = p_modulo
      )
  );
$$;

create or replace function public.resolver_ticket_soporte(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_ticket public.tickets_soporte;
  v_accesos_cerrados integer := 0;
begin
  if auth.uid() is null or not app_private.is_super_admin_saas() then
    raise exception 'Solo super_admin_saas activo puede resolver tickets';
  end if;

  select * into v_ticket
  from public.tickets_soporte
  where id = p_ticket_id
  for update;

  if v_ticket.id is null then
    raise exception 'Ticket no encontrado';
  end if;

  update public.tickets_soporte
  set estado = 'resuelto',
      fecha_cierre = now(),
      updated_at = now()
  where id = p_ticket_id;

  update public.soporte_accesos
  set estado = 'cerrado',
      fecha_fin = case when now() <= fecha_inicio then fecha_inicio + interval '1 microsecond' else least(coalesce(fecha_fin, now()), now()) end,
      updated_at = now()
  where ticket_id = p_ticket_id
    and estado = 'activo';

  get diagnostics v_accesos_cerrados = row_count;

  return jsonb_build_object('success', true, 'ticket_id', p_ticket_id, 'estado', 'resuelto', 'accesos_cerrados', v_accesos_cerrados);
end;
$$;

alter table public.tickets_soporte enable row level security;
alter table public.soporte_accesos enable row level security;

drop policy if exists tickets_soporte_admin_select_own on public.tickets_soporte;
create policy tickets_soporte_admin_select_own on public.tickets_soporte
for select to authenticated
using (gimnasio_id = app_private.current_gimnasio_id() and app_private.current_role() = 'administrador');

drop policy if exists tickets_soporte_admin_insert_own on public.tickets_soporte;
create policy tickets_soporte_admin_insert_own on public.tickets_soporte
for insert to authenticated
with check (gimnasio_id = app_private.current_gimnasio_id() and creado_por = auth.uid() and app_private.current_role() = 'administrador');

drop policy if exists tickets_soporte_admin_delete_open_own on public.tickets_soporte;
create policy tickets_soporte_admin_delete_open_own on public.tickets_soporte
for delete to authenticated
using (gimnasio_id = app_private.current_gimnasio_id() and creado_por = auth.uid() and estado = 'abierto' and app_private.current_role() = 'administrador');

drop policy if exists tickets_soporte_super_admin on public.tickets_soporte;
create policy tickets_soporte_super_admin on public.tickets_soporte
for select to authenticated using (app_private.is_super_admin_saas());

drop policy if exists tickets_soporte_super_admin_update on public.tickets_soporte;
create policy tickets_soporte_super_admin_update on public.tickets_soporte
for update to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

drop policy if exists soporte_accesos_admin_select_own on public.soporte_accesos;
create policy soporte_accesos_admin_select_own on public.soporte_accesos
for select to authenticated
using (gimnasio_id = app_private.current_gimnasio_id() and app_private.current_role() = 'administrador');

drop policy if exists soporte_accesos_admin_insert_own on public.soporte_accesos;
create policy soporte_accesos_admin_insert_own on public.soporte_accesos
for insert to authenticated
with check (gimnasio_id = app_private.current_gimnasio_id() and autorizado_por = auth.uid() and ticket_id is not null and fecha_fin > fecha_inicio and app_private.current_role() = 'administrador');

drop policy if exists saas_super_admin_soporte_accesos on public.soporte_accesos;
create policy saas_super_admin_soporte_accesos on public.soporte_accesos
for select to authenticated using (app_private.is_super_admin_saas());

drop policy if exists saas_super_admin_soporte_accesos_update on public.soporte_accesos;
create policy saas_super_admin_soporte_accesos_update on public.soporte_accesos
for update to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

do $$
declare
  regla record;
begin
  for regla in
    select * from (values
      ('"Miembros"', 'miembros'),
      ('pagos', 'pagos'),
      ('asistencias', 'asistencia'),
      ('productos', 'inventario'),
      ('proveedores', 'inventario'),
      ('compras_proveedores', 'inventario'),
      ('ventas', 'pos'),
      ('venta_detalles', 'pos'),
      ('movimientos_inventario', 'inventario'),
      ('facturas', 'facturas'),
      ('cajas_turno', 'caja'),
      ('configuracion_mensualidad', 'configuracion'),
      ('notificaciones', 'dashboard'),
      ('auditoria_eventos', 'dashboard')
    ) as alcance(tabla, modulo)
  loop
    execute format('drop policy if exists %I on public.%s', replace(regla.tabla, '"', '') || '_select_same_gym', regla.tabla);
    execute format(
      'create policy %I on public.%s for select to authenticated using (gimnasio_id = app_private.current_gimnasio_id() or (app_private.is_super_admin_saas() and app_private.soporte_activo_para_modulo(gimnasio_id, %L)))',
      replace(regla.tabla, '"', '') || '_select_same_gym',
      regla.tabla,
      regla.modulo
    );
  end loop;
end $$;

revoke all on function app_private.soporte_activo_para_modulo(uuid, text) from public, anon;
revoke all on function public.resolver_ticket_soporte(uuid) from public, anon;
grant execute on function public.resolver_ticket_soporte(uuid) to authenticated;
grant select, insert, delete, update on public.tickets_soporte to authenticated;
grant select, insert, update on public.soporte_accesos to authenticated;
