# Supabase migrations - FitControl Pro / Kilvio FIT

Este directorio contiene el set de migraciones normalizado para preparar Supabase staging antes de publicar cambios.

## Estándares aplicados

- `gimnasio_id`: `uuid` en tablas operativas, SaaS, soporte y facturación.
- Tabla de miembros canónica: `public."Miembros"`.
- No se crea `public.miembros` mientras el frontend siga usando `"Miembros"`.
- Helpers privados en `app_private` definidos una sola vez.
- RPC sensibles con `security definer`, `auth.uid()`, rol activo, estado activo, gimnasio correspondiente y `search_path = public, app_private`.
- RLS se aplica con policies únicas y `drop policy if exists` antes de recrear.
- Caja usa flujo automático por turnos; no se recrean `abrir_caja_turno` ni `cerrar_caja_turno`.

## Orden de ejecución

Ver `run-migrations-order.md`.

## Validación

Después de ejecutar las migraciones en staging, correr:

```sql
-- supabase/validation/validate_schema.sql
```

La validación revisa tablas requeridas, tipo `uuid` en `gimnasio_id`, tabla canónica de miembros, funciones únicas, ausencia de funciones legacy de caja y policies principales.

## Seguridad

No incluir ni ejecutar claves `service_role` desde estas migraciones. No hay datos operativos privados del gimnasio en el seed de staging.
