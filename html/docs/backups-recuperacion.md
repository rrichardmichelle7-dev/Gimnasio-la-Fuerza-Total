# Backups y recuperacion - Kilvio FIT

## Objetivo

Mantener integridad de miembros, pagos, ventas, facturas y caja ante errores operativos, borrados accidentales o fallas del servicio.

## Backups automaticos recomendados

1. Activar backups diarios de Supabase para la base de datos del proyecto.
2. Mantener Point-in-Time Recovery si el plan contratado lo permite.
3. Exportar diariamente tablas criticas a almacenamiento externo cifrado:
   `Miembros`, `pagos`, `ventas`, `venta_detalles`, `facturas`, `cajas_turno`, `ingresos_diarios`, `auditoria_eventos`, `perfiles`.
4. Respaldar Storage bucket `productos` con versionado o copia programada.
5. Probar restauracion mensualmente en un proyecto Supabase separado.

## Proceso de recuperacion

1. Congelar operaciones: cerrar acceso temporal al sistema o ponerlo en mantenimiento.
2. Identificar ventana afectada usando `auditoria_eventos`.
3. Restaurar en un proyecto Supabase temporal, no directamente sobre produccion.
4. Comparar conteos y totales por `gimnasio_id`:
   miembros activos, pagos por mes, ventas por dia, facturas emitidas y cajas cerradas.
5. Reconciliar pagos y ventas por recibo/factura antes de mover datos.
6. Aplicar correccion controlada a produccion con SQL transaccional.
7. Ejecutar validaciones finales:
   no hay caja abierta duplicada por usuario, totales de caja cuadran, ventas anuladas conservan factura anulada, pagos no pierden `gimnasio_id`.

## Consultas de verificacion

```sql
select gimnasio_id, count(*) from public."Miembros" group by gimnasio_id;
select gimnasio_id, date_trunc('month', fecha_pago), sum(monto) from public.pagos group by 1, 2;
select gimnasio_id, fecha, sum(total) from public.ventas where estado <> 'anulada' group by 1, 2;
select gimnasio_id, usuario_id, count(*) from public.cajas_turno where estado = 'abierta' group by 1, 2 having count(*) > 1;
```

## Reglas de integridad

- Nunca restaurar solo `pagos` sin revisar `facturas`.
- Nunca restaurar `ventas` sin `venta_detalles`, `facturas` y `movimientos_inventario`.
- Nunca mezclar datos entre gimnasios: toda recuperacion debe filtrar por `gimnasio_id`.
- Conservar `auditoria_eventos` incluso cuando se corrige un dato.
