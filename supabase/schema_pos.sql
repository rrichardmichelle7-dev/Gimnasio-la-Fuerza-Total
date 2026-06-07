-- Kilvio FIT - Preparacion POS transaccional
-- Paso 1: preparar tablas para carrito, anulacion, recibos y movimientos.
-- Ejecutar despues de supabase/schema_produccion.sql y con RLS ya activo si aplica.
-- Este script no borra datos, no elimina tablas y no desactiva RLS.

begin;

-- Ventas: estado operativo y trazabilidad de anulacion.
alter table public.ventas
add column if not exists estado text not null default 'confirmada',
add column if not exists anulada_at timestamptz,
add column if not exists anulada_por text,
add column if not exists motivo_anulacion text;

-- Facturas/recibos: estado propio y enlace semantico al estado de la venta.
alter table public.facturas
add column if not exists estado text not null default 'emitida',
add column if not exists venta_estado text,
add column if not exists anulada_at timestamptz;

-- Movimientos de inventario: permitir anulaciones como movimiento auditable.
alter table public.movimientos_inventario
drop constraint if exists movimientos_inventario_tipo_check;

alter table public.movimientos_inventario
add constraint movimientos_inventario_tipo_check
check (tipo in ('entrada', 'salida', 'ajuste', 'anulacion')) not valid;

-- Consultas frecuentes del POS: ventas por gimnasio, estado y fecha.
create index if not exists idx_ventas_gimnasio_estado_fecha
on public.ventas(gimnasio_id, estado, fecha desc);

commit;
