# Checklist de blindaje de seguridad - FitControl Pro / Kilvio FIT

Fecha: 2026-06-25
Rama: `mejoras-finales-frontend`
Estado: fase preparada para staging. No se ejecutaron cambios contra Supabase ni datos reales.

## Objetivo

Blindar el sistema antes de publicación: autenticación, autorización, aislamiento multi-gimnasio, consistencia en operaciones críticas, caja por turnos, soporte autorizado, auditoría y validaciones.

## Qué se revisó en esta pasada

- `js/auth.js`: login, perfil desde `public.perfiles`, estado del usuario, sesión, roles, redirecciones y bloqueo de usuarios no activos.
- `js/app.js`: uso de `localStorage`, flujos POS, caja automática, pagos, facturas, inventario y renderizado de módulos privados.
- `js/michel-soft.js`: Panel Michel Soft, tickets y resolución por RPC.
- `js/michel-soft-facturas.js`: facturación SaaS y pago de facturas SaaS por RPC.
- `js/supabase-client.js`: verificación de clave pública frontend y ausencia de `service_role`.
- `docs/sql-*.sql` y `../supabase/*.sql`: funciones `SECURITY DEFINER`, grants, RPC y políticas relacionadas.
- `docs/informe-seguridad-saas.md`: hallazgos previos de seguridad.

## Cambios aplicados en esta fase

Solo se crearon documentos/pruebas locales. No se cambió lógica productiva.

- `docs/security-smoke-tests.md`: matriz de pruebas smoke manuales para staging.
- `docs/sql-pruebas-rls-multigimnasio.sql`: plantilla SQL read-only para validar RLS/multi-gimnasio en staging.
- `docs/security-hardening-checklist.md`: este checklist de avance y riesgos.

## Pruebas preparadas

Ver `docs/security-smoke-tests.md`.

Resumen:

- login administrador;
- login recepción;
- login `super_admin_saas`;
- usuario inactivo bloqueado;
- usuario sin perfil bloqueado;
- recuperación de contraseña;
- sesión expirada;
- acceso directo por URL no autorizado;
- Panel Michel Soft oculto para usuarios del gimnasio;
- módulos privados ocultos para Michel Soft;
- soporte autorizado activo/vencido/cerrado;
- ausencia de datos sensibles en consola.

Resultado real: pendiente de ejecución en staging.

## Pruebas RLS / multi-gimnasio preparadas

Ver `docs/sql-pruebas-rls-multigimnasio.sql`.

Validan:

- administrador de Gimnasio A no lee Gimnasio B;
- recepción de Gimnasio A no lee Gimnasio B;
- `super_admin_saas` no lee miembros, pagos internos, POS, caja ni facturas privadas;
- `super_admin_saas` sí puede ver metadatos SaaS esperados;
- soporte autorizado se limita por estado, fecha y módulo.

Resultado real: pendiente de ejecución en staging.

## Auditoría de funciones `SECURITY DEFINER`

| Archivo | Funciones detectadas | Riesgo encontrado | Corrección propuesta | Estado |
| --- | --- | --- | --- | --- |
| `../supabase/schema.sql` | `current_gimnasio_id`, `current_user_role`, `is_admin`, `generar_numero_recibo`, `registrar_pago`, `vender_producto`, `actualizar_stock` | Varias funciones están en `public`; algunas usan `set search_path = public`. Debe confirmarse que validan `auth.uid()`, estado activo, rol y `gimnasio_id` en todos los caminos | Migrar helpers sensibles a `app_private` cuando sea posible, usar `set search_path = ''` con referencias calificadas, revocar `PUBLIC/anon`, validar perfil activo y alcance | Pendiente |
| `../supabase/schema_produccion.sql` | Equivalentes a schema principal | Mismo riesgo; posible divergencia entre archivos de esquema | Unificar fuente de verdad antes de aplicar en staging | Pendiente |
| `../supabase/schema_safe.sql` | Equivalentes a schema principal | Mismo riesgo; revisar si es versión más segura o histórica | Marcar archivo canónico y archivar duplicados | Pendiente |
| `../supabase/rpc_pos.sql` | `confirmar_venta_pos` | Es crítica: venta + inventario + factura + caja. Tiene `auth.uid()` y revokes, pero debe probarse con RLS/roles y stock concurrente | Ejecutar pruebas de concurrencia y multi-gimnasio en staging | Pendiente |
| `../supabase/rpc_anular_venta_pos.sql` | `anular_venta_pos` | Operación crítica de dinero/inventario. Debe validar rol, gimnasio, estado y evitar doble anulación | Añadir/confirmar auditoría y pruebas de doble ejecución | Pendiente |
| `docs/sql-flujo-caja-automatica-turnos.sql` | `activar_caja_turno_automatica`, `guardar_cuadre_caja_turno`, `reabrir_cuadre_caja_turno` | En `guardar_cuadre_caja_turno` aparece comparación con rol `'admin'`; el sistema usa `administrador` | Corregir rol si aún no se aplicó en SQL real; probar bloqueo por cuadre pendiente | Pendiente |
| `docs/sql-facturacion-saas-panel-michel-soft.sql` | `crear_factura_saas`, `registrar_pago_factura_saas`, `actualizar_facturas_saas_vencidas`, `resolver_ticket_soporte` | Funciones SaaS críticas; deben quedar restringidas a `super_admin_saas` y no filtrar datos privados | Validar rol internamente, revokes, auditoría y que no accedan a tablas privadas | Pendiente |
| `docs/sql-corregir-panel-michel-soft-clientes-tickets.sql` | `resolver_ticket_soporte` | Debe cerrar soporte asociado y auditar; no debe permitir resolver tickets a usuarios no SaaS | Mantener solo RPC segura si RLS bloquea update directo | Pendiente |
| `docs/sql-fitcontrol-pro-saas*.sql` | helpers SaaS y facturación SaaS | Algunas funciones `app_private` exponen execute a authenticated; deben validar rol internamente | Confirmar validaciones internas y revokes a `PUBLIC/anon` | Pendiente |
| `docs/sql-hardening-seguridad-saas.sql` | helpers `app_private` | Buena base, pero requiere ejecución controlada en staging y advisors | Ejecutar advisors y registrar resultados | Pendiente |
| `docs/sql-listar-usuarios-gimnasio.sql` / `docs/sql-autorizacion-google.sql` | `listar_usuarios_gimnasio`, helpers admin | Debe impedir que recepción liste usuarios o que admin vea otro gimnasio | Validar rol `administrador`, estado activo y gimnasio | Pendiente |

## Uso de `localStorage` / `sessionStorage`

### Permitido

- Estado visual.
- Preferencias no sensibles.
- Navegación temporal.
- Caché no autoritativa y no usada para decisiones de seguridad.

### Riesgos detectados

En `js/app.js` se conserva fallback a `localStorage` para:

- miembros;
- pagos;
- productos;
- proveedores;
- compras;
- ventas POS;
- movimientos de inventario;
- ingresos diarios;
- asistencias;
- facturas;
- número de factura local.

Riesgo: si Supabase falla, el sistema puede mostrar o calcular con información local del navegador. En un equipo compartido, esto puede filtrar datos entre usuarios o permitir decisiones basadas en datos viejos.

### Propuesta incremental

1. Mantener `localStorage` solo como caché de lectura no sensible.
2. Si Supabase no está disponible, mostrar modo degradado sin operaciones críticas.
3. Bloquear pagos, POS, caja, facturas e inventario cuando `puedeUsarSupabase()` sea falso.
4. No generar números de factura desde `localStorage`; hacerlo solo desde RPC/DB.
5. Limpiar caché por usuario/gimnasio al cerrar sesión.

Estado: pendiente de corrección en código.

## Operaciones críticas y atomicidad

| Operación | Estado observado | Riesgo | Acción propuesta |
| --- | --- | --- | --- |
| Confirmar venta POS | Usa RPC `confirmar_venta_pos` | Debe probar stock concurrente, caja activa, gimnasio y factura | Ejecutar pruebas staging con doble click/concurrencia |
| Anular venta POS | Usa RPC `anular_venta_pos` | Riesgo de doble anulación si no se valida estado | Probar doble ejecución y auditoría |
| Caja automática | Usa RPC para activar/cuadrar | Posible discrepancia de rol `admin` vs `administrador` en SQL documental | Corregir SQL canónico antes de staging |
| Registrar pago mensualidad | Revisar si aún mezcla inserts directos y factura | Puede quedar pago sin factura/caja si falla una parte | Migrar a RPC transaccional única |
| Generar factura | Hay dependencia histórica de número en localStorage | Duplicados o saltos de numeración | Número desde DB/RPC con bloqueo |
| Inventario | POS descuenta por RPC; ajustes manuales deben revisarse | Stock inconsistente si update directo falla | RPC para ajustes críticos |
| Facturación SaaS | Usa RPC para crear/pagar facturas SaaS | Debe validar `super_admin_saas` internamente | Pruebas RLS y rol en staging |

## Caja por turnos

Validaciones pendientes en staging:

- caja se crea automáticamente por usuario/turno/fecha;
- no existen duplicados por doble carga/login;
- usuario con cuadre pendiente queda bloqueado;
- pagos, POS y entradas quedan vinculados al `caja_turno_id` correcto;
- administrador consulta cuadres de su gimnasio;
- `super_admin_saas` no lee caja privada;
- totales efectivo/tarjeta/transferencia coinciden con operaciones reales.

Riesgo actual más importante: confirmar que las funciones SQL usan el rol correcto (`administrador`, no `admin`) y que RLS impide ver cajas de otro gimnasio.

## Soporte autorizado

Validaciones pendientes:

- ticket creado por cliente;
- autorización temporal con fecha inicio/fin;
- soporte cerrado o vencido revoca acceso;
- Michel Soft solo ve módulo autorizado;
- acceso es solo lectura salvo acciones SaaS explícitas;
- toda consulta/acción queda auditada.

Riesgo actual: cualquier bypass por `SECURITY DEFINER` debe validar rol, estado y alcance de módulo dentro de la función, no solo en UI.

## Auditoría requerida

Eventos mínimos a auditar:

- login importante;
- usuario desactivado/habilitado;
- cambio de rol/permisos;
- pago registrado;
- venta POS;
- anulación POS;
- factura emitida/anulada;
- cuadre guardado/reabierto;
- ticket creado;
- soporte autorizado/cerrado;
- cliente SaaS suspendido/activado;
- factura SaaS creada/pagada/vencida.

Campos mínimos:

- `usuario_id`;
- `gimnasio_id`;
- `rol`;
- `accion`;
- `modulo`;
- `fecha_hora`;
- datos relevantes sin información sensible.

Estado: parcialmente presente en SQL de caja; requiere verificación global.

## Validaciones de formularios pendientes

- montos negativos;
- fechas inválidas;
- mensualidades duplicadas;
- stock insuficiente;
- pagos sin método;
- transferencia sin referencia;
- tarjeta sin voucher;
- usuarios sin rol;
- clientes SaaS sin teléfono/correo;
- facturas sin cliente;
- doble click en botones críticos.

## Endurecimiento de sesión y acceso

Observado:

- `js/auth.js` valida sesión Supabase, perfil activo, email verificado y estado SaaS;
- usa `sessionStorage` para perfil activo;
- limpia storage al rechazar auth o usuario inactivo;
- no se observó `service_role` en frontend.

Pendiente:

- confirmar en staging que cambio de rol/estado invalida permisos rápido;
- revisar logs antes de producción;
- reducir dependencia de caché local;
- evaluar MFA para administrador y `super_admin_saas`.

## Riesgos aceptados temporalmente

1. No se ejecutaron pruebas RLS reales porque esta pasada no toca Supabase ni datos.
2. No se corrigieron funciones SQL en esta pasada para evitar cambios de esquema sin respaldo/staging.
3. `localStorage` sigue presente como fallback operativo hasta una fase de corrección específica.
4. Hay múltiples archivos SQL con funciones parecidas; falta definir el SQL canónico antes de aplicar.

## Recomendación antes de producción

Estado actual: **No listo para staging todavía**.

Motivo:

- faltan ejecutar pruebas smoke y RLS;
- falta revisar/corregir funciones `SECURITY DEFINER` en el SQL canónico;
- falta eliminar dependencia peligrosa de `localStorage` para datos sensibles;
- falta confirmar atomicidad completa en pagos/facturas/caja/inventario;
- falta verificar soporte autorizado con vencimiento/cierre real.

Siguiente paso recomendado:

1. Ejecutar las pruebas smoke con usuarios de staging.
2. Ejecutar `docs/sql-pruebas-rls-multigimnasio.sql` con placeholders reales de staging.
3. Elegir archivo SQL canónico.
4. Corregir primero caja/pagos/POS/facturas en RPC y auditoría.
5. Recién después correr advisors y preparar commit.
