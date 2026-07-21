-- 009_seed_staging.sql
-- Seed SOLO PARA STAGING. NO ejecutar en producción.
-- No contiene usuarios Auth con password ni datos reales.

insert into public.planes_saas(nombre, descripcion, precio_mensual, activo)
values
  ('Cliente 1', 'Plan base para clientes SaaS en staging.', 0, true),
  ('Cliente 1 Staging', 'Plan demo para pruebas staging.', 0, true)
on conflict (nombre) do update
set descripcion = excluded.descripcion,
    precio_mensual = excluded.precio_mensual,
    activo = excluded.activo,
    updated_at = now();

insert into public.gimnasios(id, nombre, nombre_comercial, telefono, email, estado)
values (
  '00000000-0000-4000-8000-000000000101'::uuid,
  'Gimnasio Demo Staging',
  'Gimnasio Demo Staging',
  '8090000000',
  'demo.staging@example.com',
  'activo'
)
on conflict (id) do update
set nombre = excluded.nombre,
    nombre_comercial = excluded.nombre_comercial,
    telefono = excluded.telefono,
    email = excluded.email,
    estado = excluded.estado,
    updated_at = now();

insert into public.gimnasios_clientes(
  gimnasio_id,
  nombre_gimnasio,
  nombre_comercial_gimnasio,
  propietario,
  telefono,
  email,
  plan,
  estado,
  fecha_inicio,
  fecha_vencimiento,
  mensualidad,
  estado_pago_saas,
  estado_tecnico
)
values (
  '00000000-0000-4000-8000-000000000101'::uuid,
  'Gimnasio Demo Staging',
  'Gimnasio Demo Staging',
  'Usuario Demo',
  '8090000000',
  'demo.staging@example.com',
  'Cliente 1',
  'activo',
  current_date,
  current_date + interval '30 days',
  0,
  'pagado',
  'estable'
)
on conflict (gimnasio_id) do update
set nombre_gimnasio = excluded.nombre_gimnasio,
    nombre_comercial_gimnasio = excluded.nombre_comercial_gimnasio,
    propietario = excluded.propietario,
    telefono = excluded.telefono,
    email = excluded.email,
    plan = excluded.plan,
    estado = excluded.estado,
    fecha_vencimiento = excluded.fecha_vencimiento,
    mensualidad = excluded.mensualidad,
    estado_pago_saas = excluded.estado_pago_saas,
    estado_tecnico = excluded.estado_tecnico,
    updated_at = now();

notify pgrst, 'reload schema';
