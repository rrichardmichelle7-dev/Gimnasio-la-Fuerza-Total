# Kilvio FIT

Frontend administrativo para un gimnasio, construido como una aplicación SPA con HTML, Tailwind CSS y JavaScript vanilla.

El proyecto queda preparado para conectarse a Supabase como backend administrado. Actualmente usa arrays temporales y `localStorage` para simular persistencia en el navegador mientras se conecta cada módulo.

## Tecnologías usadas

- HTML5
- Tailwind CSS por CDN
- JavaScript vanilla
- Font Awesome por CDN
- LocalStorage temporal

## Estructura de carpetas

```text
proyecto-gimnasio/
├── html/
│   └── index.html
├── js/
│   ├── app.js
│   ├── modal-system.js
│   └── supabase-client.js
├── img/
│   ├── agua.png
│   ├── gatorade.png
│   ├── creatina.png
│   ├── proteina.png
│   ├── omega.png
│   └── logo.png
└── README.md
```

## Módulos incluidos

- Dashboard
- Miembros
- Asistencia
- Pagos e historial
- Registrar pago
- Inventario
- Ingresos diarios
- Reportes
- Mensualidad
- Configuración de usuarios
- Factura imprimible
- Recibo físico tipo ticket con numeración automática

## Estado de módulos terminados

- Ingresos diarios agrupa entradas por fecha, suma cantidad y total en una sola fila diaria, conserva el historial y reinicia el cálculo del día actual según la fecha del navegador.
- Ingresos diarios guarda `usuarioRegistro`; si existe `usuarioActivo` en `localStorage`, usa ese usuario, y si no existe usa `Usuario demo`.
- Mensualidad permite configurar mensualidad fija, entrada diaria, estado y nota opcional.
- Registrar Pago usa la mensualidad fija configurada.
- Ingresos Diarios usa la entrada diaria configurada.
- Reportes calcula pagos, ingresos diarios, productos e ingresos totales con los datos guardados en `localStorage`.
- Dashboard permite navegar desde "Ver detalles" hacia Miembros, Asistencia, Pagos e Ingresos Diarios.
- El acceso a Pagos pendientes abre la tabla mostrando solo pagos pendientes.
- Las facturas reflejan el estado real del pago: `Pagado` o `Pendiente`.
- Branding visual aplicado a Kilvio FIT con logo en sidebar, dashboard y recibo.
- Dashboard incluye gráfico de ingresos por mes y tarjeta de resumen mensual.
- Miembros tiene búsqueda en tiempo real por nombre o cédula y contador dinámico.
- Asistencia calcula presentes, ausentes y porcentaje de asistencia por fecha.
- Registrar Pago calcula pagos recibidos, pendientes, total recaudado y pagos por vencer usando fecha de registro y prórroga de 3 días.
- Reportes permite elegir tipo de reporte y filtros dinámicos por miembros, pagos, asistencia e ingresos.

## Uso de LocalStorage

Las claves están centralizadas en `js/app.js`, dentro de `app.storageKeys`.

- `gimnasio_miembros`
- `gimnasio_pagos`
- `gimnasio_productos`
- `gimnasio_ingresos_productos`
- `gimnasio_ingresos_diarios`
- `gimnasio_asistencias`
- `gimnasio_usuarios`
- `gimnasio_configuracion_mensualidad`
- `gimnasio_facturas`
- `gimnasio_ultimo_numero_factura`
- `usuarioActivo` para identificar temporalmente el usuario que registra ingresos diarios.

Las funciones `cargar*` y `guardar*` contienen comentarios `TODO BACKEND` para ubicar los puntos donde debe reemplazarse `localStorage` por consultas a Supabase desde JavaScript.

## Supabase

- El backend será Supabase.
- El frontend se conectará a Supabase usando JavaScript.
- La configuración inicial estará en `js/supabase-client.js`.
- No hay llaves reales de Supabase guardadas en el repositorio.
- El módulo Miembros será el primero en conectarse a Supabase.

## Notas para Supabase

- No usar `localStorage` para autenticación real.
- Usar Supabase Auth para login real cuando se implemente autenticación.
- La sección Configuración de usuarios es una maqueta administrativa; los permisos reales deben validarse en servidor.
- La navegación SPA depende de enlaces `data-page` y secciones `.page` con el mismo `id`.
- El sistema de modales está en `js/modal-system.js`.
- La configuración de Mensualidad guarda `mensualidadFija` y `entradaDiaria`; esos valores ya son usados por pagos e ingresos diarios.
- Las imágenes de inventario se referencian como `../img/nombre.png` desde `html/index.html`.
- El logo principal se referencia como `../img/logo.png` y debe mantenerse con `object-contain` para no deformarlo.
- Las facturas guardan `id`, `numero`, `fecha`, `concepto`, `monto`, `estado` y `usuarioRegistro`.
- En ingresos diarios, `usuarioRegistro` debe venir del login real.
- En ingresos diarios, la fecha debe validarse desde Supabase para evitar manipulación desde el navegador.
- Los cálculos de pagos por vencer, vencidos y asistencia deben validarse con datos persistidos en Supabase.

## Tablas sugeridas para Supabase

- `miembros`
- `pagos`
- `productos`
- `ingresos_diarios`
- `asistencias`
- `usuarios`
- `facturas`
- `configuracion_mensualidad`

## Pendientes de Supabase

- Crear proyecto en Supabase.
- Crear tablas y políticas RLS.
- Configurar `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- Conectar primero el módulo Miembros.
- Migrar gradualmente los demás módulos desde `localStorage`.
- Configurar autenticación real con Supabase Auth.
- Definir roles y permisos reales.
- Validar fechas y auditoría de operaciones.

## Checklist actual del frontend

- `html/index.html` apunta a `../js/modal-system.js`, `../js/supabase-client.js` y `../js/app.js`.
- No hay IDs duplicados en `index.html`.
- No hay modales duplicados.
- No hay contenido después de `</body>` o `</html>`.
- Las secciones SPA tienen enlaces `data-page` correspondientes.
- Las rutas de imágenes de inventario usan `../img/...`.
