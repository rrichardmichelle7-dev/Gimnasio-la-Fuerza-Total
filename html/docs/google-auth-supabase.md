# Login con Google en Kilvio FIT

Google Auth solo valida la identidad del usuario. El permiso real para entrar a Kilvio FIT sigue dependiendo de un registro activo en `public.perfiles` con `user_id`, `email`, `gimnasio_id`, `rol` y `estado = 'activo'`.

No se crean perfiles automaticamente desde el frontend y no se usa `service_role` en el navegador.

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
http://localhost:PUERTO/html/index.html
https://TU-DOMINIO/html/index.html
```

7. El frontend redirige despues de Google a:

```js
window.location.origin + "/html/index.html"
```

## Agregar un usuario autorizado con Google

1. El administrador crea o autoriza el usuario en Supabase Auth. Tambien puede permitir que Google cree el usuario en el primer intento.
2. Copia el `id` del usuario desde `Authentication > Users`.
3. Crea el registro correspondiente en `public.perfiles`:

```sql
insert into public.perfiles (
  user_id,
  email,
  nombre,
  rol,
  gimnasio_id,
  estado
) values (
  'AUTH_USER_UUID',
  'usuario@gmail.com',
  'Nombre del usuario',
  'recepcion',
  'GIMNASIO_UUID',
  'activo'
);
```

Si tu tabla usa `id` como FK directa a `auth.users.id`, usa `id = 'AUTH_USER_UUID'` segun el esquema real de tu proyecto.

## Probar con un Gmail autorizado

1. Confirma que el usuario existe en Supabase Auth.
2. Confirma que `public.perfiles` tiene el `user_id` del usuario, `gimnasio_id`, `rol` y `estado = 'activo'`.
3. Entra a `html/login.html`.
4. Haz clic en `Continuar con Google`.
5. Completa el login de Google.
6. Al volver a Kilvio FIT, debe cargar `index.html` con el perfil activo y el `gimnasio_id`.

## Probar con un Gmail no autorizado

1. Usa una cuenta Gmail que no tenga registro activo en `public.perfiles`.
2. Entra a `html/login.html`.
3. Haz clic en `Continuar con Google`.
4. Completa el login de Google.
5. Al volver, Kilvio FIT debe cerrar la sesion y mostrar:

```text
Este correo no está autorizado para acceder al sistema. Solicita acceso al administrador.
```

