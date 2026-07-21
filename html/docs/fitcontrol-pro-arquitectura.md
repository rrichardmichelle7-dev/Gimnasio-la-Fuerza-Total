# FitControl Pro - arquitectura SaaS multi-gimnasio

## Objetivo

FitControl Pro separa el producto SaaS de Michel Soft de la operacion privada de cada gimnasio. Kilvio FIT sigue funcionando como cliente actual, pero ahora queda preparado para convivir con otros gimnasios bajo el mismo sistema.

El frontend cliente de Kilvio FIT nunca renderiza ni enlaza el Panel Michel Soft. El acceso administrativo vive en una superficie independiente y exige el rol `super_admin_saas`.

## Cambios implementados

- Se agrego el rol interno `super_admin_saas`.
- Se agrego el permiso visual `panel_michel_soft`.
- `super_admin_saas` no requiere `gimnasio_id` para entrar.
- `super_admin_saas` solo puede abrir el Panel Michel Soft.
- Los usuarios de gimnasios siguen requiriendo `gimnasio_id`.
- Si `gimnasios_clientes.estado` es `suspendido` o `cancelado`, el login muestra: `Cuenta suspendida. Contacte a Michel Soft.`
- Se creo el acceso administrativo independiente `michel-soft.html`.
- Las consultas SaaS viven en `js/michel-soft.js`; `index.html` y `js/app.js` no renderizan el Panel Michel Soft.

## Tablas nuevas

El archivo `docs/sql-fitcontrol-pro-saas.sql` crea:

- `public.gimnasios_clientes`: metadatos de clientes SaaS.
- `public.soporte_accesos`: ventanas de soporte temporal aprobadas por el administrador del gimnasio.

El archivo `docs/sql-fitcontrol-pro-saas-fase2.sql` agrega la capa comercial:

- `public.planes_saas`: planes comerciales de FitControl Pro.
- `public.pagos_saas`: historial de cobros, renovaciones y vencimientos SaaS.
- `public.tickets_soporte`: tickets comerciales y tecnicos de clientes.
- `public.alertas_vencimiento_saas`: alertas generadas por vencimiento o suspension.

Campos clave de `gimnasios_clientes`:

- `gimnasio_id`
- `nombre_gimnasio`
- `propietario`
- `telefono`
- `email`
- `plan`
- `estado`
- `fecha_inicio`
- `fecha_vencimiento`
- `mensualidad`
- `estado_pago_saas`
- `estado_tecnico`
- `usuarios_count`

## Como administra Michel Soft

Michel Soft debe crear usuarios internos en Supabase Auth y asignarles en `public.perfiles`:

- `rol = 'super_admin_saas'`
- `estado = 'activo'`
- `gimnasio_id = null`
- `permisos = ['panel_michel_soft']`

Desde el Panel Michel Soft puede ver:

- total de gimnasios registrados
- activos
- en prueba
- suspendidos
- cancelados
- mensualidad esperada
- proximos vencimientos
- soporte temporal pendiente o activo
- estado tecnico general

## Privacidad operativa

Por defecto, `super_admin_saas` no accede a:

- miembros
- pagos de miembros
- facturas
- ventas POS
- cuadre de caja
- informacion personal de clientes del gimnasio

El frontend oculta todos los modulos operativos para `super_admin_saas`. En Supabase, las policies de `docs/sql-fitcontrol-pro-saas.sql` permiten a Michel Soft leer metadatos SaaS y soporte autorizado, no datos operativos por defecto.

## Soporte autorizado

Cuando un administrador del gimnasio necesita ayuda, debe registrar una fila en `soporte_accesos`:

- `gimnasio_id`
- `autorizado_por`
- `fecha_inicio`
- `fecha_fin`
- `motivo`
- `estado = 'activo'`

Solo mientras la ventana esta activa, las policies opcionales permiten lectura de tablas operativas filtradas por ese `gimnasio_id`. No se concede escritura para soporte.

## Suspension y activacion

Para suspender:

```sql
update public.gimnasios_clientes
set estado = 'suspendido', estado_pago_saas = 'vencido', updated_at = now()
where gimnasio_id = '<uuid-del-gimnasio>';
```

Para activar:

```sql
update public.gimnasios_clientes
set estado = 'activo', estado_pago_saas = 'al_dia', updated_at = now()
where gimnasio_id = '<uuid-del-gimnasio>';
```

El frontend ya bloquea el login al detectar `suspendido` o `cancelado`. La siguiente fase debe agregar `app_private.cliente_saas_activo(gimnasio_id)` a las policies operativas existentes para que Supabase bloquee tambien cualquier token vigente.

## Fase 2 - Billing y gestion comercial

El Panel Michel Soft ahora muestra:

- MRR: suma de mensualidades de gimnasios `activo` y `prueba`.
- Ingresos del mes: pagos SaaS `pagado` con `fecha_pago` dentro del mes actual.
- Pagos pendientes: suma de pagos SaaS `pendiente` y `vencido`.
- Clientes vencidos: gimnasios activos o en prueba con `fecha_vencimiento` vencida.
- Historial de pagos SaaS.
- Tickets de soporte abiertos.

### Renovaciones automaticas

La funcion `app_private.generar_renovaciones_saas()` crea pagos pendientes para clientes activos o en prueba cuyo vencimiento esta a 7 dias o menos. Usa un indice unico parcial para evitar duplicados por periodo.

### Alertas de vencimiento

La funcion `app_private.generar_alertas_vencimiento_saas()` crea alertas para pagos pendientes o vencidos con vencimiento cercano. Las alertas quedan en `alertas_vencimiento_saas` para que luego se puedan enviar por correo, WhatsApp o panel interno.

### Suspension automatica por mora

La funcion `app_private.suspender_clientes_saas_morosos(current_date, 3)` marca pagos como `vencido` y suspende gimnasios con mora mayor a 3 dias. Al suspender, el login bloquea el acceso con: `Cuenta suspendida. Contacte a Michel Soft.`

### Registrar pagos SaaS

Michel Soft debe registrar cobros usando `app_private.marcar_pago_saas_pagado(...)` o una pantalla administrativa que llame esa funcion. Al marcar un pago como pagado:

- el pago pasa a `pagado`
- se registra metodo, referencia y usuario
- el gimnasio suspendido vuelve a `activo`
- `estado_pago_saas` pasa a `al_dia`
- `fecha_vencimiento` se extiende al final del periodo pagado

### Programacion diaria

Si Supabase tiene `pg_cron` habilitado, programar:

```sql
select cron.schedule('fitcontrol-pro-renovaciones-diarias', '15 3 * * *', $$select app_private.generar_renovaciones_saas(current_date);$$);
select cron.schedule('fitcontrol-pro-alertas-vencimiento', '20 3 * * *', $$select app_private.generar_alertas_vencimiento_saas(current_date);$$);
select cron.schedule('fitcontrol-pro-suspension-mora', '30 3 * * *', $$select app_private.suspender_clientes_saas_morosos(current_date, 3);$$);
```

Si no se usa `pg_cron`, ejecutar esas funciones desde un job externo seguro, nunca desde el navegador.

## Pruebas recomendadas

- Usuario `administrador` de Kilvio FIT entra y ve Dashboard, miembros, pagos, asistencia, inventario, POS, facturas, caja, usuarios y permisos.
- Usuario `recepcion` entra y solo ve sus modulos permitidos.
- Usuario `super_admin_saas` entra sin `gimnasio_id` y solo ve Panel Michel Soft.
- Usuario `super_admin_saas` no puede abrir rutas operativas escribiendo `data-page` manualmente en consola.
- Gimnasio `suspendido` no puede iniciar sesion y recibe el mensaje de suspension.
- Dos gimnasios con datos distintos no pueden leer datos cruzados desde Supabase.
- Soporte temporal vencido no permite lectura operativa.
- Soporte temporal activo permite solo lectura del gimnasio autorizado.
- Confirmar que el frontend no contiene `service_role`.
- Crear un pago SaaS pendiente, marcarlo como pagado y verificar que actualiza `gimnasios_clientes`.
- Crear un pago vencido y ejecutar `suspender_clientes_saas_morosos`; verificar bloqueo de login.
- Ejecutar `generar_renovaciones_saas` dos veces y confirmar que no duplica periodos.
- Ejecutar `generar_alertas_vencimiento_saas` y confirmar una sola alerta por pago/tipo/dia.
## Recordatorios de pago por WhatsApp

La primera fase abre un enlace `wa.me` con el teléfono del propietario y un mensaje de cobro prellenado. El usuario debe revisar y enviar manualmente el mensaje desde WhatsApp.

El envío automático real no debe implementarse desde el frontend. Requiere un backend seguro y uno de estos servicios autorizados:

- WhatsApp Cloud API de Meta.
- Twilio WhatsApp API.
- Un proveedor externo autorizado.

Las credenciales, tokens y secretos del proveedor deben permanecer exclusivamente en backend o funciones seguras. Nunca deben incluirse en `michel-soft.js`, HTML ni claves públicas del navegador.
## Flujo de soporte autorizado

- Solo un perfil `administrador` del gimnasio puede crear tickets desde **Soporte Michel Soft**.
- El ticket se guarda en `public.tickets_soporte`; una autorización opcional crea una ventana en `public.soporte_accesos` enlazada por `ticket_id`.
- La autorización tiene inicio, fin, módulo, responsable y estado. Al vencer o cerrarse deja de habilitar lecturas operativas.
- Michel Soft ve metadatos SaaS, tickets y ventanas por defecto. Los datos operativos permanecen ocultos.
- Una sesión `super_admin_saas` solo obtiene lectura del gimnasio, tabla y módulo expresamente autorizados mientras la ventana esté activa. No existen políticas de escritura operativa para soporte.
- `otro`, `dashboard` y `usuarios` no conceden lectura automática de tablas privadas; requieren diagnóstico con el contexto del ticket o una ampliación explícita y revisada de políticas.
- Cerrar soporte marca la ventana `cerrado`, finaliza su vigencia y resuelve el ticket asociado.
- La evidencia adjunta queda reservada para una fase futura con Supabase Storage y políticas por gimnasio.

Antes de probar el flujo contra Supabase, ejecutar `docs/sql-flujo-soporte-autorizado.sql` después de los scripts SaaS base y revisar las políticas en el SQL Editor.
