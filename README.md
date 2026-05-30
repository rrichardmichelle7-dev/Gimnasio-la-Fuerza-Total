# Kilvio FIT

Sistema administrativo para gimnasio construido con HTML, Tailwind CSS por CDN y JavaScript puro. La app conserva el frontend existente y agrega una capa Supabase para autenticacion real, perfiles por gimnasio y una base de datos multi-gimnasio/SaaS.

## Tecnologias

- HTML5
- Tailwind CSS por CDN
- JavaScript vanilla
- Font Awesome por CDN
- Supabase Auth y Postgres
- `localStorage` solo como fallback temporal de datos operativos

## Estructura principal

```text
Gimnasio-la-Fuerza-Total/
├── html/
│   ├── index.html
│   └── login.html
├── img/
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── modal-system.js
│   └── supabase-client.js
├── supabase/
│   └── schema.sql
└── README.md
```

## Supabase

El esquema completo esta en `supabase/schema.sql`. Incluye:

- `gimnasios`
- `perfiles`
- `miembros`
- `pagos`
- `asistencias`
- `ingresos_diarios`
- `productos`
- `ventas`
- `configuracion_mensualidad`
- `notificaciones`

Tambien incluye UUIDs por defecto, `created_at`, `updated_at`, triggers automaticos de actualizacion, indices, constraints basicos y RLS para aislar datos por `gimnasio_id`.

## Ejecutar el SQL

1. Entra a tu proyecto en Supabase.
2. Ve a SQL Editor.
3. Copia el contenido de `supabase/schema.sql`.
4. Ejecutalo completo.
5. Revisa que RLS quede activo en todas las tablas.

## Configurar el cliente Supabase

Edita `js/supabase-client.js`:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU_ANON_KEY_PUBLICA";
```

Usa solamente la `anon public key`. Nunca pegues la `service_role key` en archivos del frontend.

## Crear el primer administrador

1. En Supabase, crea el usuario desde `Authentication > Users`.
2. En SQL Editor, crea el gimnasio:

```sql
insert into public.gimnasios (nombre, telefono, email, direccion)
values ('Kilvio FIT', '809-000-0000', 'admin@kilviofit.com', 'Direccion del gimnasio')
returning id;
```

3. Copia el UUID del gimnasio y el UUID del usuario creado en Auth.
4. Crea el perfil administrador:

```sql
insert into public.perfiles (id, gimnasio_id, nombre, rol, permisos)
values (
  'AUTH_USER_UUID',
  'GIMNASIO_UUID',
  'Administrador',
  'administrador',
  '["dashboard","miembros","asistencia","ingresos_diarios","pagos","registrar_pago","inventario","reportes","mensualidad","configuracion"]'::jsonb
);
```

5. Crea la configuracion inicial:

```sql
insert into public.configuracion_mensualidad (gimnasio_id)
values ('GIMNASIO_UUID');
```

## Login y permisos

- `html/login.html` usa Supabase Auth con email y password.
- `html/index.html` llama `protectRoute()` antes de iniciar la app.
- `js/auth.js` obtiene el usuario actual, carga `perfiles`, guarda un `usuarioActivo` seguro en `sessionStorage` y aplica permisos al menu.
- El boton `Cerrar sesion` ejecuta `auth.logout()`.

Permisos soportados:

- `dashboard`
- `miembros`
- `asistencia`
- `ingresos_diarios`
- `pagos`
- `registrar_pago`
- `inventario`
- `reportes`
- `mensualidad`
- `configuracion`

## Estado actual de datos

La autenticacion, perfiles y permisos ya estan preparados para Supabase. Los modulos operativos mantienen `localStorage` como fallback temporal mientras se migra cada CRUD a consultas Supabase filtradas por `gimnasio_id`. El archivo `app.js` ya lee el `gimnasio_id` desde el perfil activo y deja marcados los puntos de migracion.

## Seguridad

- No se usa `service_role` en frontend.
- No se guardan contrasenas en `localStorage`.
- Supabase Auth gestiona email/password.
- RLS filtra datos por `gimnasio_id`.
- Los permisos del menu son visuales; la seguridad real esta en RLS.
- Los perfiles deben crearse manualmente o por una futura invitacion administrada.

## Pendiente para produccion

- Migrar CRUD de miembros, pagos, asistencia, inventario, ventas, ingresos diarios y reportes desde `localStorage` a Supabase.
- Crear flujo de invitaciones para usuarios nuevos.
- Agregar validaciones de permisos por accion en funciones de escritura.
- Configurar Storage para logos e imagenes de productos.
- Agregar backups, auditoria y monitoreo.
- Revisar URLs permitidas de Auth en Supabase para dominio final.
