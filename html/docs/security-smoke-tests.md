# Pruebas smoke de seguridad - FitControl Pro / Kilvio FIT

Fecha de preparación: 2026-06-25
Estado: preparadas para staging, no ejecutadas contra datos reales.

## Alcance

Estas pruebas validan autenticación, roles, bloqueo por estado, aislamiento entre Panel Michel Soft y módulos privados del gimnasio, y flujos mínimos de acceso. Deben ejecutarse únicamente en staging con usuarios de prueba.

## Matriz de usuarios de prueba

| Usuario | Rol esperado | Estado | Gimnasio | Uso |
| --- | --- | --- | --- | --- |
| admin.staging@example.com | administrador | activo | Gimnasio A | Validar acceso completo del gimnasio propio |
| recepcion.staging@example.com | recepcion | activo | Gimnasio A | Validar acceso limitado |
| superadmin.staging@example.com | super_admin_saas | activo | sin gimnasio privado | Validar Panel Michel Soft |
| inactivo.staging@example.com | recepcion | inactivo | Gimnasio A | Validar expulsión por estado |
| desactivado.staging@example.com | recepcion | desactivado/suspendido | Gimnasio A | Validar bloqueo total |

> Sustituir estos correos por cuentas reales de staging. No usar cuentas productivas.

## Pruebas

| ID | Prueba | Pasos | Resultado esperado | Resultado real |
| --- | --- | --- | --- | --- |
| AUTH-01 | Login administrador | Iniciar sesión como administrador activo | Entra a `index.html`, ve módulos permitidos del gimnasio propio | Pendiente |
| AUTH-02 | Login recepción | Iniciar sesión como recepción activo | Entra a `index.html`, no ve opciones administrativas no permitidas | Pendiente |
| AUTH-03 | Login super_admin_saas | Iniciar sesión como `super_admin_saas` | Entra a `michel-soft.html`, no entra al sistema privado del gimnasio | Pendiente |
| AUTH-04 | Usuario inactivo bloqueado | Iniciar sesión con perfil `estado != activo` | Cierra sesión y redirige a `login.html?error=usuario_inactivo` | Pendiente |
| AUTH-05 | Usuario sin perfil bloqueado | Iniciar sesión con Auth válido pero sin fila en `public.perfiles` | Redirige a login con error de usuario no autorizado | Pendiente |
| AUTH-06 | Recuperación de contraseña | Solicitar recuperación desde login | Supabase envía enlace y la UI muestra confirmación clara | Pendiente |
| AUTH-07 | Sesión expirada | Borrar sesión/token y abrir `index.html` | Redirige a login sin mostrar datos cacheados | Pendiente |
| AUTH-08 | Acceso directo a ruta no autorizada | Recepción abre URL de módulo no permitido | UI bloquea/oculta módulo; RLS debe impedir datos si intenta consulta | Pendiente |
| AUTH-09 | Panel Michel Soft oculto para usuarios del gimnasio | Administrador/recepción intenta abrir `michel-soft.html` | Acceso denegado o redirección segura | Pendiente |
| AUTH-10 | Módulos privados ocultos para Michel Soft | `super_admin_saas` intenta abrir `index.html` | Acceso denegado; no muestra miembros, ventas, caja, pagos ni facturas internas | Pendiente |
| SESSION-01 | Cierre por inactividad | Mantener sesión sin uso más del límite configurado | Se cierra sesión y no queda información sensible visible | Pendiente |
| SESSION-02 | Cambio de rol/estado | Cambiar rol/estado en staging y refrescar sesión | El cambio se refleja sin esperar indefinidamente | Pendiente |
| SAAS-01 | Cliente SaaS suspendido | Perfil de gimnasio asociado a cliente SaaS suspendido | Login bloqueado o sistema muestra suspensión sin cargar datos privados | Pendiente |
| SUPPORT-01 | Soporte autorizado activo | Crear ticket y soporte activo para módulo específico | Michel Soft ve solo el módulo autorizado y durante la ventana vigente | Pendiente |
| SUPPORT-02 | Soporte vencido | Usar soporte con `fecha_fin < now()` | Acceso denegado/revocado | Pendiente |
| SUPPORT-03 | Soporte cerrado | Cerrar soporte/ticket y refrescar | Acceso denegado/revocado | Pendiente |
| STORAGE-01 | Sin datos sensibles en consola | Recorrer login, pagos, POS, caja, Michel Soft | No aparecen tokens, claves, datos privados ni logs temporales peligrosos | Pendiente |

## Evidencia esperada

Guardar capturas o notas por cada prueba con:

- usuario usado;
- fecha/hora;
- ruta visitada;
- resultado real;
- diferencia con resultado esperado;
- corrección necesaria si falla.

## Archivos relacionados

- `login.html`
- `index.html`
- `michel-soft.html`
- `js/auth.js`
- `js/app.js`
- `js/michel-soft.js`
- `js/michel-soft-facturas.js`
- `js/user-identity.js`
- `js/supabase-client.js`
