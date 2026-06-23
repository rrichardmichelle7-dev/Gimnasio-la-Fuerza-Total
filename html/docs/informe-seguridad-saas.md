# Informe de seguridad SaaS - Kilvio FIT

## Vulnerabilidades encontradas

- Consultas a tablas operativas sin filtro explicito por `gimnasio_id` en varios modulos.
- Fallback a `localStorage` para datos sensibles cuando Supabase falla, con riesgo de fuga entre usuarios del mismo navegador.
- Autorizacion de UI parcialmente basada en ocultar menus, sin bloqueo central de rutas internas.
- Ausencia de recuperacion de contrasena desde la pantalla de login.
- Falta de verificacion explicita de correo antes de permitir entrada.
- Auditoria operativa incompleta para miembros, pagos, caja, ventas y permisos.
- Validacion limitada de archivos de imagen.
- Riesgo de rol obsoleto `Entrenador` en perfiles existentes.

## Cambios realizados

- Se reforzo `js/auth.js` con:
  - Google login y correo/contrasena existentes.
  - Recuperacion y actualizacion de contrasena por correo.
  - Validacion de correo verificado.
  - Logout seguro.
  - Cierre automatico por inactividad configurable con `window.KILVIO_INACTIVITY_TIMEOUT_MINUTES`.
  - Deteccion periodica de sesion expirada o token invalido.
  - Autorizacion basada en `public.perfiles`, no en `user_metadata`.

- Se reforzo `login.html` con:
  - Formulario de recuperacion de contrasena.
  - Formulario de nueva contrasena para enlaces de recovery.
  - Mensajes de sesion expirada, usuario inactivo y correo no verificado.

- Se reforzo `js/app.js` con:
  - Bloqueo de carga local sensible sin Supabase y `gimnasio_id`.
  - Validacion de permisos antes de mostrar rutas internas.
  - Filtros explicitos por `gimnasio_id` en consultas criticas.
  - Sanitizacion de textos/referencias.
  - Validacion de imagenes por tipo y limite de 2 MB.
  - Auditoria desde cliente para miembros, pagos, ingresos, caja, ventas y permisos.
  - Bloqueo de escrituras locales cuando falta sesion Supabase.

- Se agrego `docs/sql-hardening-seguridad-saas.sql` con:
  - Eliminacion logica del rol `Entrenador`.
  - Constraints para roles validos.
  - RLS multi-gimnasio.
  - Tabla `auditoria_eventos`.
  - Politicas de Storage para imagenes.
  - Indice unico para impedir dos cajas abiertas por usuario y gimnasio.

- Se agrego `docs/backups-recuperacion.md` con:
  - Estrategia de backups automaticos.
  - Proceso de restauracion.
  - Consultas de verificacion de integridad.

## Recomendaciones futuras

- Mover operaciones criticas a Edge Functions o RPC transaccionales auditadas.
- Aplicar y probar el SQL en un proyecto staging antes de produccion.
- Usar invitaciones por gimnasio para que las solicitudes de acceso nazcan vinculadas a `gimnasio_id`.
- Agregar MFA para administradores.
- Reducir expiracion JWT en Supabase para operaciones sensibles.
- Automatizar pruebas RLS por rol y por gimnasio.
