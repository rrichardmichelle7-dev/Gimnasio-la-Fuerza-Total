# Checklist de pruebas staging - FitControl Pro / Kilvio FIT

Fecha de referencia: 2026-06-26
Entorno: staging
Rama esperada: `mejoras-finales-frontend`
Supabase esperado: proyecto staging
Vercel esperado: preview/staging conectado a `mejoras-finales-frontend`

> No ejecutar estas pruebas en producción. Usar solo usuarios y datos de prueba.

## 1. Preparación del entorno

- [ ] Confirmar rama local: `mejoras-finales-frontend`.
- [ ] Confirmar que `main` no fue modificada ni mergeada.
- [ ] Confirmar que Vercel staging apunta a la rama `mejoras-finales-frontend`.
- [ ] Confirmar que `html/js/env.js` tiene `APP_ENV: "staging"`.
- [ ] Confirmar que `html/js/env.js` usa Project URL de Supabase staging.
- [ ] Confirmar que `html/js/env.js` usa solo Publishable Key pública.
- [ ] Confirmar que no existe `service_role`, `sb_secret` ni secret key en frontend.
- [ ] Confirmar que las migraciones staging fueron ejecutadas en orden.
- [ ] Ejecutar `supabase/validation/validate_schema.sql` en staging.
- [ ] Confirmar que `validate_schema.sql` no devuelve `FALTA`, `FALLA` ni `REVISAR` críticos.

## 2. Login y autenticación

### super_admin_saas

- [ ] Iniciar sesión con usuario `super_admin_saas` de prueba.
- [ ] Debe entrar al Panel Michel Soft.
- [ ] Debe ver nombre, rol `Super Admin SaaS` y botón de cerrar sesión.
- [ ] No debe ver miembros, ventas, caja, facturas ni pagos internos de gimnasios salvo flujo autorizado de soporte.
- [ ] Cerrar sesión correctamente.

### Administrador gimnasio

- [ ] Iniciar sesión con administrador de gimnasio de prueba.
- [ ] Debe entrar a Kilvio FIT.
- [ ] Debe ver nombre, rol `Administrador` y botón de cerrar sesión.
- [ ] Debe ver módulos operativos autorizados del gimnasio.
- [ ] No debe ver Panel Michel Soft.
- [ ] Cerrar sesión correctamente.

### Recepción

- [ ] Iniciar sesión con usuario recepción de prueba.
- [ ] Debe entrar a Kilvio FIT.
- [ ] Debe ver nombre, rol `Recepción` y botón de cerrar sesión.
- [ ] Debe ver solo módulos permitidos para recepción.
- [ ] No debe ver Panel Michel Soft.
- [ ] No debe poder administrar usuarios ni configuración sensible.

### Usuario inactivo

- [ ] Intentar iniciar sesión con usuario inactivo de prueba.
- [ ] Debe ser bloqueado o expulsado del sistema.
- [ ] No debe cargar dashboard ni datos operativos.
- [ ] Si ya tenía sesión abierta, debe cerrarse o quedar sin acceso efectivo.

## 3. Seguridad SaaS y RLS

- [ ] Usuario de Gimnasio A no puede leer miembros de Gimnasio B.
- [ ] Usuario de Gimnasio A no puede leer pagos de Gimnasio B.
- [ ] Usuario de Gimnasio A no puede leer ventas/POS de Gimnasio B.
- [ ] Usuario de Gimnasio A no puede modificar inventario de Gimnasio B.
- [ ] Panel Michel Soft está oculto para usuarios de gimnasio.
- [ ] Módulos privados del gimnasio están ocultos para Michel Soft sin soporte autorizado.
- [ ] Acceso de soporte autorizado solo habilita módulos autorizados y por tiempo válido.
- [ ] Al resolver ticket, soporte autorizado asociado se cierra.
- [ ] `anon` no puede leer tablas operativas privadas.
- [ ] Las RPC sensibles rechazan usuarios sin rol/estado/gimnasio válido.

## 4. Operación Kilvio FIT

### Miembros

- [ ] Crear miembro de prueba.
- [ ] Editar miembro de prueba.
- [ ] Cambiar estado del miembro.
- [ ] Buscar/filtrar miembro.
- [ ] Confirmar que el miembro queda asociado al `gimnasio_id` correcto.

### Asistencia

- [ ] Registrar asistencia manual.
- [ ] Confirmar historial de asistencia.
- [ ] Confirmar que no muestra asistencias de otro gimnasio.

### Pagos

- [ ] Registrar pago de mensualidad.
- [ ] Confirmar recibo o comprobante generado.
- [ ] Confirmar método de pago y referencia si aplica.
- [ ] Confirmar que el pago cae en la caja automática del turno actual.

### POS

- [ ] Crear producto de prueba.
- [ ] Confirmar venta POS en efectivo.
- [ ] Confirmar venta POS con transferencia/tarjeta y referencia.
- [ ] Confirmar descuento/total/cambio si aplica.
- [ ] Confirmar factura/recibo POS.
- [ ] Confirmar reducción de stock.
- [ ] Anular venta con administrador y confirmar reposición de stock.

### Inventario

- [ ] Crear producto.
- [ ] Editar producto.
- [ ] Validar stock mínimo.
- [ ] Registrar movimiento de entrada/salida si aplica.
- [ ] Confirmar aislamiento multi-gimnasio.

### Facturas

- [ ] Generar factura operativa/POS.
- [ ] Ver detalle de factura.
- [ ] Confirmar estado emitida/anulada.
- [ ] Confirmar que no aparecen facturas de otro gimnasio.

### Caja automática por turnos

- [ ] Realizar venta/pago sin caja manual abierta.
- [ ] Confirmar que se crea caja automática del turno actual.
- [ ] Confirmar que pagos y ventas quedan asociados a `caja_turno_id`.
- [ ] Guardar cuadre de caja.
- [ ] Confirmar total sistema, total contado y diferencia.
- [ ] Confirmar bloqueo o alerta por cuadre pendiente antes de operar en flujo restringido.
- [ ] Reabrir cuadre solo con administrador.

## 5. Panel Michel Soft / SaaS

### Clientes SaaS

- [ ] Abrir Panel Michel Soft con `super_admin_saas`.
- [ ] Crear cliente SaaS con campos mínimos.
- [ ] Editar cliente SaaS.
- [ ] Confirmar que Kilvio FIT aparece como `Cliente 1` si existe en staging.
- [ ] Confirmar que no se muestran datos operativos privados del gimnasio.

### Facturas SaaS

- [ ] Crear factura SaaS.
- [ ] Ver factura SaaS.
- [ ] Marcar factura como pagada.
- [ ] Confirmar actualización de estado de pago SaaS.
- [ ] Confirmar WhatsApp de factura usando teléfono del cliente.

### Pagos SaaS

- [ ] Registrar pago SaaS.
- [ ] Confirmar método, referencia y estado.
- [ ] Confirmar que no toca pagos internos del gimnasio.

### Tickets

- [ ] Crear ticket de soporte de prueba.
- [ ] Cambiar estado del ticket.
- [ ] Marcar ticket como resuelto.
- [ ] Confirmar contador de tickets abiertos actualizado.

### Soporte autorizado

- [ ] Autorizar soporte para un módulo específico.
- [ ] Confirmar acceso solo al módulo autorizado.
- [ ] Confirmar que módulos no autorizados siguen ocultos.
- [ ] Resolver ticket asociado.
- [ ] Confirmar que `soporte_accesos.estado` pasa a `cerrado`.

### WhatsApp

- [ ] Probar WhatsApp con `propietario_whatsapp`.
- [ ] Probar fallback con `propietario_telefono`.
- [ ] Probar fallback con `telefono`.
- [ ] Probar fallback con `telefono_gimnasio`.
- [ ] Probar fallback con `contacto_principal_telefono`.
- [ ] Confirmar formato RD de 10 dígitos convertido a prefijo `1`.
- [ ] Confirmar mensaje si no existe teléfono: `Este cliente no tiene teléfono registrado.`

## 6. Responsive/móvil

- [ ] Login usable en móvil.
- [ ] Header muestra usuario compacto.
- [ ] Menú lateral usable en móvil.
- [ ] Tablas principales no rompen layout.
- [ ] Modales de miembros, pagos, POS, clientes SaaS y tickets son usables en móvil.
- [ ] Botones críticos mantienen tamaño táctil adecuado.

## 7. Evidencia mínima por prueba

Para cada prueba registrar:

- Fecha/hora.
- Usuario usado.
- Entorno/URL.
- Resultado esperado.
- Resultado real.
- Pasa/Falla.
- Captura o error si falla.
- Prioridad del fallo: alta, media o baja.

## 8. Criterio para aprobar staging

- [ ] No hay fallos críticos de login/auth.
- [ ] No hay fuga multi-gimnasio.
- [ ] No hay acceso indebido a Panel Michel Soft.
- [ ] No hay acceso de Michel Soft a módulos privados sin soporte autorizado.
- [ ] Caja automática funciona en ventas y pagos.
- [ ] POS no descuenta stock incorrectamente.
- [ ] Facturación SaaS y WhatsApp funcionan con datos de prueba.
- [ ] `validate_schema.sql` queda limpio.
- [ ] No hay secretos en frontend.
