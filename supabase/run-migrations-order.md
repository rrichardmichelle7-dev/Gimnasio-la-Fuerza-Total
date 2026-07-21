# Ejecución manual de migraciones Supabase - FitControl Pro

No ejecutar en producción hasta validar staging. Estas migraciones fueron normalizadas para una base staging limpia.

## Decisiones de normalización

- `gimnasio_id` es `uuid` en todas las tablas nuevas y migraciones.
- La tabla canónica de miembros se mantiene como `public."Miembros"` porque el frontend actual la usa con ese nombre.
- No se crea `public.miembros` para evitar doble fuente de verdad.
- `public.listar_usuarios_gimnasio`, `public.resolver_ticket_soporte`, `app_private.is_admin` y `app_private.current_admin_gimnasio_id` tienen una sola definición final.
- Caja usa solo el flujo automático por turnos: detectar turno, crear caja automática, guardar cuadre y reabrir cuadre con administrador.
- Las funciones legacy `abrir_caja_turno` y `cerrar_caja_turno` no se crean en el set normalizado.
- Las funciones sensibles usan `security definer`, validan `auth.uid()`/rol/estado/gimnasio y fijan `search_path = public, app_private`.

## Orden manual recomendado

1. Confirmar que estás en el proyecto Supabase staging.
2. Confirmar que la rama local es `mejoras-finales-frontend`.
3. Abrir Supabase Dashboard del proyecto staging.
4. Ir a SQL Editor.
5. Ejecutar completo, en este orden:
   - `supabase/migrations/001_base_schema.sql`
   - `supabase/migrations/002_auth_profiles_users.sql`
   - `supabase/migrations/003_saas_core.sql`
   - `supabase/migrations/004_saas_billing.sql`
   - `supabase/migrations/005_security_rls_hardening.sql`
   - `supabase/migrations/006_pos_payments_inventory_rpc.sql`
   - `supabase/migrations/007_support_authorized_flow.sql`
   - `supabase/migrations/008_invoice_saas.sql`
6. Ejecutar `supabase/migrations/009_seed_staging.sql` solo si quieres datos demo de staging.
7. Ejecutar `supabase/validation/validate_schema.sql`.
8. Revisar que no aparezcan estados `FALTA`, `FALLA` o `REVISAR`.

## Qué NO ejecutar en producción todavía

- `009_seed_staging.sql` nunca debe ejecutarse en producción.
- Ninguna migración debe ejecutarse en producción hasta completar smoke tests, pruebas RLS y revisión de resultados en staging.

## Si una migración falla

1. Detenerse y no ejecutar la siguiente.
2. Copiar el error completo.
3. Clasificar si es: tipo incompatible, tabla existente con forma distinta, función duplicada, policy duplicada o dependencia faltante.
4. Corregir primero en staging.
5. No aplicar corrección en producción sin revisión.
