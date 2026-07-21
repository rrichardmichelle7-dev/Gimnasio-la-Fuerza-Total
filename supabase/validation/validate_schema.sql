-- FitControl Pro / Kilvio FIT - validación post migraciones staging.
-- Solo lectura. Ejecutar después de aplicar 001-008 y, si corresponde, 009_seed_staging.

with expected_tables(schema_name, table_name) as (
  values
    ('public', 'gimnasios'),
    ('public', 'Miembros'),
    ('public', 'perfiles'),
    ('public', 'solicitudes_acceso'),
    ('public', 'gimnasios_clientes'),
    ('public', 'planes_saas'),
    ('public', 'pagos_saas'),
    ('public', 'facturas_saas'),
    ('public', 'tickets_soporte'),
    ('public', 'soporte_accesos'),
    ('public', 'productos'),
    ('public', 'ventas'),
    ('public', 'venta_detalles'),
    ('public', 'cajas_turno'),
    ('public', 'auditoria_eventos')
)
select 'table' as tipo,
       schema_name || '.' || table_name as objeto,
       case when t.table_name is null then 'FALTA' else 'OK' end as estado
from expected_tables e
left join information_schema.tables t
  on t.table_schema = e.schema_name
 and t.table_name = e.table_name
order by objeto;

select 'canonical_members_table' as tipo,
       'public."Miembros" canonical / public.miembros absent' as objeto,
       case
         when to_regclass('public."Miembros"') is not null and to_regclass('public.miembros') is null then 'OK'
         else 'REVISAR'
       end as estado;

with gimnasio_columns as (
  select table_schema, table_name, data_type, udt_name
  from information_schema.columns
  where table_schema = 'public'
    and column_name = 'gimnasio_id'
    and table_name in (
      'Miembros','perfiles','solicitudes_acceso','pagos','asistencias','productos','proveedores',
      'compras_proveedores','ventas','venta_detalles','movimientos_inventario','facturas',
      'cajas_turno','configuracion_mensualidad','notificaciones','auditoria_eventos',
      'gimnasios_clientes','soporte_accesos','pagos_saas','alertas_vencimiento_saas','facturas_saas','tickets_soporte'
    )
)
select 'gimnasio_id_type' as tipo,
       table_schema || '.' || table_name as objeto,
       case when udt_name = 'uuid' then 'OK' else 'FALLA: ' || data_type || '/' || udt_name end as estado
from gimnasio_columns
order by objeto;

with expected_functions(schema_name, function_name, expected_count) as (
  values
    ('app_private', 'is_admin', 1),
    ('app_private', 'current_admin_gimnasio_id', 1),
    ('app_private', 'is_super_admin_saas', 1),
    ('public', 'listar_usuarios_gimnasio', 1),
    ('public', 'cambiar_estado_usuario', 1),
    ('public', 'activar_caja_turno_automatica', 1),
    ('public', 'guardar_cuadre_caja_turno', 1),
    ('public', 'reabrir_cuadre_caja_turno', 1),
    ('public', 'confirmar_venta_pos', 1),
    ('public', 'anular_venta_pos', 1),
    ('public', 'crear_factura_saas', 1),
    ('public', 'registrar_pago_factura_saas', 1),
    ('public', 'actualizar_facturas_saas_vencidas', 1),
    ('public', 'resolver_ticket_soporte', 1)
), found as (
  select routine_schema, routine_name, count(*) as qty
  from information_schema.routines
  where routine_type = 'FUNCTION'
  group by routine_schema, routine_name
)
select 'function_count' as tipo,
       e.schema_name || '.' || e.function_name as objeto,
       case when coalesce(f.qty, 0) = e.expected_count then 'OK' else 'FALLA: ' || coalesce(f.qty, 0)::text end as estado
from expected_functions e
left join found f on f.routine_schema = e.schema_name and f.routine_name = e.function_name
order by objeto;

with legacy_functions(schema_name, function_name) as (
  values
    ('public', 'abrir_caja_turno'),
    ('public', 'cerrar_caja_turno')
)
select 'legacy_function_absent' as tipo,
       schema_name || '.' || function_name as objeto,
       case when r.routine_name is null then 'OK' else 'FALLA: legacy presente' end as estado
from legacy_functions l
left join information_schema.routines r
  on r.routine_schema = l.schema_name
 and r.routine_name = l.function_name
 and r.routine_type = 'FUNCTION'
order by objeto;

select 'policy' as tipo,
       schemaname || '.' || tablename || '.' || policyname as objeto,
       cmd as estado
from pg_policies
where schemaname = 'public'
  and tablename in (
    'perfiles','solicitudes_acceso','gimnasios_clientes','planes_saas','pagos_saas',
    'facturas_saas','tickets_soporte','soporte_accesos','productos','ventas',
    'venta_detalles','cajas_turno','auditoria_eventos','Miembros'
  )
order by tablename, policyname;
