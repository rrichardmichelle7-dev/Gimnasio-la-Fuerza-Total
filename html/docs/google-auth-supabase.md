# Login con Google y autorizacion en Kilvio FIT

Google Auth solo valida la identidad del usuario. El permiso real para entrar a Kilvio FIT depende de un registro activo en `public.perfiles` con `user_id`, `gimnasio_id`, `rol`, `permisos` y `estado = 'activo'`.

No se crean usuarios con contraseña desde el frontend y no se usa `service_role` en el navegador.

## SQL requerido

Ejecuta en Supabase SQL Editor el archivo:

```text
docs/sql-autorizacion-google.sql
```

Ese SQL crea `public.solicitudes_acceso`, activa RLS, permite que el usuario autenticado inserte su propia solicitud y permite que un administrador activo apruebe, rechace y administre perfiles de su gimnasio.

Si la tabla ya existe y solo necesitas corregir el error de RLS al aprobar usuarios, ejecuta:

```text
docs/sql-corregir-aprobacion-usuarios.sql
```

Si el administrador no ve todos los usuarios activos por RLS en `public.perfiles`, ejecuta:

```text
docs/sql-listar-usuarios-gimnasio.sql
```

La pantalla `Usuarios activos` usa la RPC `listar_usuarios_gimnasio()` para listar solo perfiles del mismo `gimnasio_id` del administrador activo, sin cambiar la lectura de perfil propio usada por el login.

## Configurar Google Provider en Supabase

1. Entra al proyecto de Supabase.
2. Ve a `Authentication > Providers > Google`.
3. Activa Google.
4. Configura el `Client ID` y `Client Secret` creados en Google Cloud Console.
5. En Google Cloud Console, agrega como Authorized redirect URI la URL callback de Supabase:

```text
https://TU-PROYECTO.supabase.co/auth/v1/callback
```

6. En Supabase, revisa `Authentication > URL Configuration` y agrega las URLs permitidas del sistema, por ejemplo:

```text
http://127.0.0.1:5500/index.html
https://TU-DOMINIO/index.html
```

7. El frontend redirige despues de Google a:

```js
window.location.origin + "/index.html"
```

## Probar usuario pendiente

1. Usa una cuenta Gmail que no tenga registro activo en `public.perfiles`.
2. Entra a `html/login.html`.
3. Haz clic en `Continuar con Google`.
4. Completa el login de Google.
5. Al volver, Kilvio FIT crea o actualiza una fila en `public.solicitudes_acceso`, cierra sesion y muestra:

```text
Tu solicitud de acceso fue enviada. Espera aprobación del administrador.
```

6. Si la misma cuenta vuelve a intentar entrar mientras sigue pendiente, debe mostrar:

```text
Tu solicitud de acceso está pendiente de aprobación.
```

## Aprobar usuario desde administrador

1. Entra con un usuario que ya tenga perfil activo en `public.perfiles` con `rol = 'administrador'`.
2. Abre `Configuración`.
3. En `Usuarios y Accesos`, revisa `Solicitudes pendientes`.
4. Haz clic en `Aprobar usuario`.
5. Confirma o edita el nombre, selecciona rol (`administrador` o `recepcion`), permisos y estado `activo`.
6. Guarda. El sistema crea el registro en `public.perfiles` usando:

```text
user_id = solicitud.user_id
nombre = nombre seleccionado
rol = rol seleccionado
permisos = permisos seleccionados
estado = activo
gimnasio_id = gimnasio del administrador actual
```

7. La solicitud queda con `estado = 'aprobada'`, `aprobado_por = auth.uid()` y `aprobado_at = now()`.

## Probar usuario autorizado

1. Aprueba la solicitud desde `Configuración > Usuarios y Accesos`.
2. Cierra cualquier sesion previa de la cuenta aprobada.
3. Entra a `html/login.html`.
4. Haz clic en `Continuar con Google`.
5. Completa el login de Google.
6. Al volver a Kilvio FIT, debe cargar `index.html` con el perfil activo y el `gimnasio_id`.
