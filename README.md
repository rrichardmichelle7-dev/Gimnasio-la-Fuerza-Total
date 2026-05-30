# Gimnasio Kilvio Fit

Frontend administrativo para un gimnasio, construido como una aplicación SPA con HTML, Tailwind CSS y JavaScript vanilla.

El proyecto queda preparado para conectarse a un backend futuro con API, base de datos, login real, roles y permisos. Actualmente usa arrays temporales y `localStorage` para simular persistencia en el navegador.

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
│   └── modal-system.js
├── img/
│   ├── agua.png
│   ├── gatorade.png
│   ├── creatina.png
│   ├── proteina.png
│   └── omega.png
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

Las funciones `cargar*` y `guardar*` contienen comentarios `TODO BACKEND` para ubicar los puntos donde debe reemplazarse `localStorage` por `fetch` o por un cliente HTTP.

## Notas para el programador backend

- No usar `localStorage` para autenticación real.
- No guardar contraseñas en texto plano.
- La sección Configuración de usuarios es una maqueta administrativa; los permisos reales deben validarse en servidor.
- La navegación SPA depende de enlaces `data-page` y secciones `.page` con el mismo `id`.
- El sistema de modales está en `js/modal-system.js`.
- La configuración de Mensualidad guarda `mensualidadFija` y `entradaDiaria`; esos valores ya son usados por pagos e ingresos diarios.
- Las imágenes de inventario se referencian como `../img/nombre.png` desde `html/index.html`.

## Endpoints sugeridos para API futura

Autenticación:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Miembros:

- `GET /api/miembros`
- `POST /api/miembros`
- `PUT /api/miembros/:id`
- `DELETE /api/miembros/:id`

Pagos:

- `GET /api/pagos`
- `POST /api/pagos`
- `GET /api/pagos/:id/factura`

Asistencia:

- `GET /api/asistencias?fecha=YYYY-MM-DD`
- `POST /api/asistencias`

Inventario:

- `GET /api/productos`
- `POST /api/productos`
- `PUT /api/productos/:id`
- `DELETE /api/productos/:id`
- `POST /api/productos/:id/venta`

Ingresos diarios:

- `GET /api/ingresos-diarios`
- `POST /api/ingresos-diarios`

Mensualidad:

- `GET /api/configuracion/mensualidad`
- `PUT /api/configuracion/mensualidad`

Reportes:

- `GET /api/reportes/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Usuarios, roles y permisos:

- `GET /api/usuarios`
- `POST /api/usuarios`
- `PUT /api/usuarios/:id`
- `DELETE /api/usuarios/:id`
- `GET /api/roles`
- `PUT /api/roles/:id/permisos`

## Pendientes del backend

- Login real con sesiones o JWT.
- Base de datos.
- Roles y permisos reales validados en servidor.
- Hash de contraseñas.
- Protección contra acceso no autorizado.
- Validación de datos en servidor.
- Auditoría de pagos, ventas y cambios de configuración.
- Exportación real de reportes a PDF o Excel.

## Checklist actual del frontend

- `html/index.html` apunta a `../js/modal-system.js` y `../js/app.js`.
- No hay IDs duplicados en `index.html`.
- No hay modales duplicados.
- No hay contenido después de `</body>` o `</html>`.
- Las secciones SPA tienen enlaces `data-page` correspondientes.
- Las rutas de imágenes de inventario usan `../img/...`.
