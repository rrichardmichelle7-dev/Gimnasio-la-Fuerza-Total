# Gimnasio La Fuerza Total

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
- Punto de Venta (POS)
- Ventas de productos
- Proveedores
- Compras a proveedores
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
- `gimnasio_proveedores`
- `gimnasio_compras_proveedores`
- `gimnasio_ventas`
- `gimnasio_movimientos_inventario`

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

POS e inventario avanzado:

- `GET /api/proveedores`
- `POST /api/proveedores`
- `POST /api/compras-proveedores`
- `GET /api/ventas`
- `POST /api/ventas`
- `POST /api/movimientos-inventario`

## POS preparado

- Productos temporales por categoría: bebidas, snacks, suplementos y accesorios.
- Tarjetas modernas para productos con precio, costo, stock, stock mínimo, imagen y estado.
- Alertas visuales de stock bajo.
- POS con búsqueda, carrito, edición de cantidades, métodos de pago y recibo.
- Compras a proveedores aumentan stock automáticamente.
- Ventas descuentan stock y registran movimientos de inventario.
- `supabase-pos-schema.sql` documenta tablas futuras con `gimnasio_id`: `productos`, `proveedores`, `compras_proveedores`, `ventas`, `venta_detalles` y `movimientos_inventario`.

## 🔒 Seguridad y Pendientes antes de Producción

### Estado Actual (Desarrollo)
Este sistema está preparado para desarrollo local y demostración. **NO usar en producción sin implementar las medidas de seguridad abajo.**

### Vulnerabilidades Críticas Identificadas

#### 🔴 ALTA: Contraseñas en localStorage
- **Problema:** Las contraseñas se guardan en texto plano en localStorage
- **Riesgo:** Acceso a credenciales vía DevTools del navegador
- **Solución:** Implementar Supabase Auth (eliminar `app.usuarios` completamente)
- **Archivo:** `js/app.js` - Remover función `cargarUsuarios()` y `guardarUsuarios()`

#### 🔴 ALTA: Datos sensibles sin encripción
- **Problema:** Cédulas, teléfonos, nombres guardan en localStorage
- **Riesgo:** Violación de privacidad (incumple GDPR/RGPD)
- **Solución:** Trasladar a Supabase con Row Level Security (RLS)
- **Tablas necesarias:** `miembros`, `pagos`, `productos`

#### 🔴 ALTA: Sin sistema de autenticación
- **Problema:** Todos acceden a todos los datos sin login
- **Riesgo:** Acceso no autorizado a datos financieros y personales
- **Solución:** Implementar Supabase Auth
  ```javascript
  // TODO SECURITY: En index.html, agregar antes de cargar app.js
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
  
  // TODO SECURITY: En app.js, verificar sesión
  supabase.auth.onAuthStateChanged(user => {
      if (!user) {
          // Mostrar login
          return;
      }
      app.init(user.id);
  });
  ```

#### 🔴 ALTA: Datos financieros en localStorage
- **Problema:** Montos de pago, referencias sin cifrado
- **Riesgo:** Fraud, modificación de registros
- **Solución:** Base de datos segura (Supabase) con validación en servidor

#### 🟠 MEDIA: Falta validaciones de entrada
- **Problema:** Inputs aceptan cualquier dato sin restricciones
- **Riesgo:** Inyección de datos maliciosos
- **Solución:** Agregar validaciones regex
  ```javascript
  // Ejemplo: validar cédula dominicana
  const cedulaRegex = /^\d{3}-?\d{7}-?\d{1}$/;
  if (!cedulaRegex.test(cedula)) {
      mostrarAlerta("error", "Cédula inválida");
      return;
  }
  ```

#### 🟠 MEDIA: Onclick inline en DOM dinámico
- **Problema:** `onclick="app.marcarPresente(${miembro.id})"` generado en templates
- **Riesgo:** Potencial XSS si ID contiene caracteres especiales
- **Solución:** Usar event listeners en lugar de onclick
  ```javascript
  btn.addEventListener('click', () => app.marcarPresente(miembro.id));
  ```

#### 🟠 MEDIA: Sin confirmación fuerte para eliminaciones
- **Problema:** `confirm()` es fácil de ignorar
- **Riesgo:** Pérdida accidental de datos críticos
- **Solución:** Modal de confirmación con contraseña/doble clic

#### 🟠 MEDIA: Falta de HTTPS/Headers de seguridad
- **Problema:** No se especifica HTTPS obligatorio
- **Riesgo:** Man-in-the-Middle attacks
- **Solución:** Agregar headers en servidor
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdn.tailwindcss.com
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  ```

#### 🟢 BAJA: Console.log de información del sistema
- **Problema:** Logs que revelan estructura interna
- **Riesgo:** Información para planificación de ataques
- **Solución:** Remover logs de producción ✅ (YA HECHO)

### Checklist: Antes de Entregar en Producción

- [ ] **Configurar Supabase:**
  - [ ] Crear proyecto Supabase
  - [ ] Copiar URL y ANON_KEY a `js/supabase-client.js`
  - [ ] Crear tablas: `profiles`, `miembros`, `pagos`, `productos`, `asistencias`
  - [ ] Habilitar RLS en todas las tablas
  - [ ] Crear políticas RLS para cada tabla

- [ ] **Implementar Autenticación:**
  - [ ] Crear página de login (`html/login.html`)
  - [ ] Usar `supabase.auth.signInWithPassword()`
  - [ ] Setup listener: `supabase.auth.onAuthStateChanged()`
  - [ ] Bloquear acceso a app si no hay usuario autenticado

- [ ] **Implementar Autorización (RLS):**
  - [ ] Usuarios solo ven miembros de su gimnasio
  - [ ] Admins pueden editar/eliminar, otros solo lectura
  - [ ] Asociar cada registro a `user_id`

- [ ] **Migraciones de Datos:**
  - [ ] Exportar datos de localStorage como CSV
  - [ ] Importar a Supabase (bulk insert)
  - [ ] Verificar integridad de datos

- [ ] **Headers de Seguridad:**
  - [ ] Configurar HTTPS obligatorio
  - [ ] Agregar CSP headers
  - [ ] Agregar X-Frame-Options

- [ ] **Validaciones:**
  - [ ] Agregar regex para cédula, teléfono, email
  - [ ] Validar montos (no negativos, máximo razonable)
  - [ ] Sanitizar entradas (ya hay `escaparHtml()`, verificar uso)

- [ ] **Testing:**
  - [ ] Probar con datos reales
  - [ ] Verificar RLS funciona (usuario A no ve datos de usuario B)
  - [ ] Probar login/logout
  - [ ] Probar eliminaciones con confirmación

- [ ] **Documentación:**
  - [ ] Documentar variables de entorno
  - [ ] Crear script de setup inicial
  - [ ] Documentar permisos de Supabase

### Archivo de Configuración Recomendado

Crear `.env` (no commiter a git):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

Agregar `.env.example` (para documentar):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-key-here
```

### Recursos de Supabase

- Documentación RLS: https://supabase.com/docs/guides/auth/row-level-security
- SQL Policies: https://supabase.com/docs/guides/auth/row-level-security/examples
- Auth Docs: https://supabase.com/docs/guides/auth
- Security Best Practices: https://supabase.com/docs/guides/platform/security

### Recomendaciones Finales

1. **NO exponer `service_role_key` en frontend** - Solo usar en backend
2. **La `anon_key` es segura en frontend** - Protegida por RLS
3. **Siempre validar en servidor** - El frontend puede ser bypassed
4. **Usar HTTPS en producción** - Obligatorio para datos sensibles
5. **Implementar logging de auditoría** - Quién hace qué y cuándo
6. **Backup regular de datos** - Supabase tiene backups automáticos

---

**Estado de Seguridad:** 🔴 NO LISTO PARA PRODUCCIÓN (Requiere implementar Supabase + Auth)
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
