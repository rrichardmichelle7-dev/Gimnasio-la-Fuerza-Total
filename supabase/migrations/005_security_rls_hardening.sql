-- 005_security_rls_hardening.sql
-- RLS policies. Every policy is dropped before creation.

alter table public.gimnasios enable row level security;
alter table public."Miembros" enable row level security;
alter table public.perfiles enable row level security;
alter table public.solicitudes_acceso enable row level security;
alter table public.pagos enable row level security;
alter table public.asistencias enable row level security;
alter table public.productos enable row level security;
alter table public.proveedores enable row level security;
alter table public.compras_proveedores enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.facturas enable row level security;
alter table public.cajas_turno enable row level security;
alter table public.configuracion_mensualidad enable row level security;
alter table public.notificaciones enable row level security;
alter table public.auditoria_eventos enable row level security;
alter table public.gimnasios_clientes enable row level security;
alter table public.soporte_accesos enable row level security;
alter table public.planes_saas enable row level security;
alter table public.pagos_saas enable row level security;
alter table public.alertas_vencimiento_saas enable row level security;

drop policy if exists gimnasios_select_own_or_super on public.gimnasios;
create policy gimnasios_select_own_or_super on public.gimnasios
for select to authenticated
using (id = app_private.current_gimnasio_id());

drop policy if exists perfiles_select_scope on public.perfiles;
create policy perfiles_select_scope on public.perfiles
for select to authenticated
using (user_id = auth.uid() or gimnasio_id = app_private.current_admin_gimnasio_id());

drop policy if exists perfiles_admin_update_same_gym on public.perfiles;
create policy perfiles_admin_update_same_gym on public.perfiles
for update to authenticated
using (gimnasio_id = app_private.current_admin_gimnasio_id())
with check (gimnasio_id = app_private.current_admin_gimnasio_id());

do $$
declare
  t text;
  clean text;
begin
  foreach t in array array[
    '"Miembros"', 'pagos', 'asistencias', 'productos', 'proveedores', 'compras_proveedores',
    'ventas', 'venta_detalles', 'movimientos_inventario', 'facturas', 'cajas_turno',
    'configuracion_mensualidad', 'notificaciones', 'auditoria_eventos'
  ] loop
    clean := replace(t, '"', '');
    execute format('drop policy if exists %I on public.%s', clean || '_select_same_gym', t);
    execute format('create policy %I on public.%s for select to authenticated using (gimnasio_id = app_private.current_gimnasio_id())', clean || '_select_same_gym', t);

    execute format('drop policy if exists %I on public.%s', clean || '_insert_same_gym', t);
    execute format('create policy %I on public.%s for insert to authenticated with check (gimnasio_id = app_private.current_gimnasio_id())', clean || '_insert_same_gym', t);

    execute format('drop policy if exists %I on public.%s', clean || '_update_same_gym', t);
    execute format('create policy %I on public.%s for update to authenticated using (gimnasio_id = app_private.current_gimnasio_id()) with check (gimnasio_id = app_private.current_gimnasio_id())', clean || '_update_same_gym', t);

    execute format('drop policy if exists %I on public.%s', clean || '_delete_admin_same_gym', t);
    execute format('create policy %I on public.%s for delete to authenticated using (gimnasio_id = app_private.current_admin_gimnasio_id())', clean || '_delete_admin_same_gym', t);
  end loop;
end $$;

drop policy if exists solicitudes_acceso_admin_same_gym on public.solicitudes_acceso;
create policy solicitudes_acceso_admin_same_gym on public.solicitudes_acceso
for all to authenticated
using (gimnasio_id = app_private.current_admin_gimnasio_id())
with check (gimnasio_id = app_private.current_admin_gimnasio_id());

drop policy if exists saas_super_admin_gimnasios_clientes on public.gimnasios_clientes;
create policy saas_super_admin_gimnasios_clientes on public.gimnasios_clientes
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

drop policy if exists saas_super_admin_soporte_accesos on public.soporte_accesos;
create policy saas_super_admin_soporte_accesos on public.soporte_accesos
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

drop policy if exists saas_planes_select_authenticated on public.planes_saas;
create policy saas_planes_select_authenticated on public.planes_saas
for select to authenticated using (true);

drop policy if exists saas_planes_write_super_admin on public.planes_saas;
create policy saas_planes_write_super_admin on public.planes_saas
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

drop policy if exists saas_pagos_super_admin on public.pagos_saas;
create policy saas_pagos_super_admin on public.pagos_saas
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

drop policy if exists saas_alertas_super_admin on public.alertas_vencimiento_saas;
create policy saas_alertas_super_admin on public.alertas_vencimiento_saas
for all to authenticated using (app_private.is_super_admin_saas()) with check (app_private.is_super_admin_saas());

revoke all on schema app_private from public, anon;
revoke all on all functions in schema app_private from public, anon;
