# Resultados fase de blindaje en staging - 2026-06-25

## Reglas de ejecución

- Rama verificada: `mejoras-finales-frontend`.
- `main` no fue tocada.
- No se hizo commit.
- No se hizo push.
- No se desplegó.
- No se aplicaron correcciones.
- No se ejecutaron cambios contra Supabase.
- No se usaron datos reales.

## Estado del entorno

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Rama actual | Pasa | `../.git/HEAD` contiene `ref: refs/heads/mejoras-finales-frontend` |
| No tocar `main` | Pasa | No se cambió de rama ni se hizo merge |
| Configuración separada de staging | Falla / bloquea pruebas | No se encontró `SUPABASE_URL` de staging ni archivo `.env`/config dedicado a staging |
| Endpoint Supabase visible | Riesgo alto | `js/supabase-client.js` contiene un único endpoint: `https://fpmybokqphpeoaszmolo.supabase.co` |
| Usuarios de prueba reales | Bloqueado | Solo existen placeholders documentados (`admin.staging@example.com`, etc.); no hay contraseñas ni confirmación de cuentas staging |
| Supabase CLI | Bloqueado | `Get-Command supabase` devolvió “The term 'supabase' is not recognized” |
| SQL RLS listo para ejecución | Bloqueado | `docs/sql-pruebas-rls-multigimnasio.sql` aún contiene placeholders `:ADMIN_GYM_A_USER_ID`, `:GIMNASIO_A_ID`, etc. |
| `service_role` en frontend | Pasa con observación | Solo aparece en comentario preventivo de `js/supabase-client.js`; no se encontró clave `service_role`/`sb_secret` en JS/HTML |

## Resultado de pruebas smoke

Estas pruebas no se ejecutaron con login real porque no hay usuarios/contraseñas de staging verificables ni URL staging diferenciada. Ejecutarlas contra el endpoint único visible podría tocar producción, por lo que se bloquearon por seguridad.

| ID | Prueba | Resultado esperado | Resultado real | Estado | Evidencia / error |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Login administrador | Entra a `index.html`, ve módulos permitidos del gimnasio propio | No ejecutado | Bloqueado | Falta usuario/clave de staging y URL staging verificable |
| AUTH-02 | Login recepción | Entra a `index.html`, no ve opciones administrativas no permitidas | No ejecutado | Bloqueado | Falta usuario/clave de staging y URL staging verificable |
| AUTH-03 | Login `super_admin_saas` | Entra a `michel-soft.html`, no entra al sistema privado | No ejecutado | Bloqueado | Falta usuario/clave de staging y URL staging verificable |
| AUTH-04 | Usuario inactivo bloqueado | Cierra sesión y redirige a `login.html?error=usuario_inactivo` | No ejecutado | Bloqueado | Falta usuario/clave de staging y URL staging verificable |
| AUTH-05 | Usuario sin perfil bloqueado | Redirige a login con error de usuario no autorizado | No ejecutado | Bloqueado | Requiere cuenta Auth staging sin perfil |
| AUTH-06 | Recuperación de contraseña | Supabase envía enlace y UI muestra confirmación | No ejecutado | Bloqueado | Requiere cuenta/correo staging |
| AUTH-07 | Sesión expirada | Redirige a login sin mostrar datos cacheados | No ejecutado | Bloqueado | Requiere sesión staging |
| AUTH-08 | Acceso directo a ruta no autorizada | UI bloquea/oculta módulo; RLS impide datos | No ejecutado | Bloqueado | Requiere sesión recepción staging |
| AUTH-09 | Panel Michel Soft oculto para usuarios del gimnasio | Acceso denegado o redirección segura | No ejecutado | Bloqueado | Requiere sesión admin/recepción staging |
| AUTH-10 | Módulos privados ocultos para Michel Soft | Acceso denegado; no muestra datos privados | No ejecutado | Bloqueado | Requiere sesión `super_admin_saas` staging |
| SESSION-01 | Cierre por inactividad | Cierra sesión y no deja datos sensibles visibles | No ejecutado | Bloqueado | Requiere sesión staging y espera controlada |
| SESSION-02 | Cambio de rol/estado | Cambio se refleja sin espera prolongada | No ejecutado | Bloqueado | Requiere modificar usuario staging; no autorizado sin entorno confirmado |
| SAAS-01 | Cliente SaaS suspendido | Login bloqueado o suspensión sin cargar datos privados | No ejecutado | Bloqueado | Requiere cliente SaaS staging suspendido |
| SUPPORT-01 | Soporte autorizado activo | Michel Soft ve solo módulo autorizado durante ventana vigente | No ejecutado | Bloqueado | Requiere ticket/acceso temporal staging |
| SUPPORT-02 | Soporte vencido | Acceso denegado/revocado | No ejecutado | Bloqueado | Requiere acceso vencido staging |
| SUPPORT-03 | Soporte cerrado | Acceso denegado/revocado | No ejecutado | Bloqueado | Requiere ticket/acceso cerrado staging |
| STORAGE-01 | Sin datos sensibles en consola | No aparecen tokens, claves ni datos privados | Parcial | Pasa parcial | Búsqueda estática no encontró `service_role` real ni `sb_secret` en JS/HTML; no reemplaza prueba en navegador |

## Resultado de pruebas RLS / multi-gimnasio

El archivo `docs/sql-pruebas-rls-multigimnasio.sql` no se ejecutó porque:

1. No hay URL/DB staging diferenciada.
2. No hay credenciales de DB staging.
3. La CLI Supabase no está instalada.
4. El SQL contiene placeholders que deben reemplazarse por IDs de usuarios y gimnasios de staging.
5. Ejecutarlo contra el único endpoint visible podría tocar producción.

| Prueba | Resultado esperado | Resultado real | Estado | Evidencia / error |
| --- | --- | --- | --- | --- |
| RLS-ADMIN-A-MIEMBROS-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta `:ADMIN_GYM_A_USER_ID` y `:GIMNASIO_B_ID` reales de staging |
| RLS-ADMIN-A-PAGOS-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-ADMIN-A-VENTAS-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-ADMIN-A-CAJA-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-RECEPCION-A-MIEMBROS-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta `:RECEPCION_GYM_A_USER_ID` real |
| RLS-RECEPCION-A-FACTURAS-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-RECEPCION-A-INVENTARIO-OTRO-GYM | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-MIEMBROS-PRIVADOS | 0 filas | No ejecutado | Bloqueado | Falta `:SUPER_ADMIN_SAAS_USER_ID` real |
| RLS-SAAS-PAGOS-PRIVADOS | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-POS-PRIVADO | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-CAJA-PRIVADA | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-FACTURAS-PRIVADAS | 0 filas | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-CLIENTES-SAAS | Metadatos SaaS visibles | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-FACTURAS-SAAS | Metadatos SaaS visibles | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SAAS-TICKETS | Tickets SaaS visibles | No ejecutado | Bloqueado | Falta staging DB |
| RLS-SOPORTE-ACTIVO-MODULO | Solo accesos activos vigentes | No ejecutado | Bloqueado | Falta `:GIMNASIO_A_ID` real |
| RLS-SOPORTE-VENCIDO-CERRADO | Acceso vencido/cerrado no concede datos privados | No ejecutado | Bloqueado | Falta staging DB |

## Fallos / bloqueos encontrados

| Prioridad | Hallazgo | Impacto | Recomendación |
| --- | --- | --- | --- |
| Alta | No hay configuración staging separada en el repo | No se puede garantizar que las pruebas no toquen producción | Crear/confirmar proyecto Supabase staging y archivo de configuración local no versionado |
| Alta | No hay usuarios de prueba verificables | No se puede ejecutar login/roles/rutas de forma segura | Crear cuentas staging para administrador, recepción, `super_admin_saas`, inactivo y sin perfil |
| Alta | SQL RLS contiene placeholders | No puede ejecutarse hasta reemplazar IDs por datos de staging | Preparar copia staging del SQL con IDs reales o variables controladas |
| Alta | Supabase CLI no está instalada | No se puede ejecutar `supabase db query`/advisors desde este entorno | Instalar CLI o usar Supabase SQL Editor/MCP autenticado contra staging |
| Alta | Endpoint único en frontend | Riesgo de confundir staging con producción | Separar `SUPABASE_URL`/key por entorno antes de pruebas reales |
| Media | Búsqueda estática solo valida ausencia obvia de claves privadas | No sustituye pruebas dinámicas de navegador | Ejecutar STORAGE-01 con DevTools/consola en staging |

## Recomendación

Estado: **No listo para ejecutar pruebas reales de staging desde este entorno todavía**.

Antes de continuar se necesita:

1. URL y publishable key del proyecto Supabase staging.
2. Confirmación explícita de que `https://fpmybokqphpeoaszmolo.supabase.co` no es producción, si se pretende usar ese endpoint.
3. Usuarios de prueba con credenciales de staging.
4. IDs staging para reemplazar placeholders del SQL RLS.
5. Una vía segura para ejecutar SQL en staging: Supabase CLI instalada, MCP autenticado o SQL Editor manual.
