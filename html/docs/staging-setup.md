# Configuración de staging y producción - FitControl Pro / Kilvio FIT

## Objetivo

Permitir que el mismo frontend pueda apuntar a Supabase staging o Supabase producción sin usar claves privadas.

## Archivos involucrados

- `js/env.example.js`
- `js/env.js`
- `js/supabase-client.js`
- `index.html`
- `login.html`
- `michel-soft.html`

## Qué valores se usan

Solo se usan valores públicos de Supabase:

- `APP_ENV`: `staging` o `production`
- `SUPABASE_URL`: Project URL del proyecto Supabase
- `SUPABASE_PUBLISHABLE_KEY`: Publishable Key pública del proyecto

Nunca usar:

- `service_role`
- secret key
- claves privadas
- tokens personales

## Archivo local por entorno

`js/env.example.js` es la plantilla versionada. `js/env.js` es el archivo real de cada entorno y nunca debe subirse a GitHub.

Para configurar cualquier entorno:

1. Copiar `js/env.example.js` como `js/env.js`.
2. Pegar el Project URL y la Publishable Key del entorno correspondiente.
3. Mantener `js/env.js` fuera de Git.
4. Usar archivos `env.js` distintos para staging y producción.
5. Nunca usar Secret Key ni `service_role`.

## Configurar staging

En la rama `mejoras-finales-frontend`, copia `js/env.example.js` como `js/env.js` y reemplaza los placeholders:

```js
window.FITCONTROL_ENV = {
  APP_ENV: "staging",
  SUPABASE_URL: "https://TU-PROYECTO-STAGING.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "TU_PUBLISHABLE_KEY_STAGING"
};
```

Luego abre `login.html`, `index.html` o `michel-soft.html`.

Para verificar en el navegador, abre la consola y ejecuta:

```js
window.fitControlEnvironment
```

Debe mostrar:

```js
{
  appEnv: "staging",
  supabaseUrl: "https://TU-PROYECTO-STAGING.supabase.co"
}
```

## Configurar producción

Producción debe vivir en la rama `main`.

Crear un `js/env.js` propio de producción, fuera de Git, con los valores públicos de Supabase producción:


```js
window.FITCONTROL_ENV = {
  APP_ENV: "production",
  SUPABASE_URL: "https://TU-PROYECTO-PRODUCCION.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "TU_PUBLISHABLE_KEY_PRODUCCION"
};
```

## Qué NO subir

No subir nunca:

- `js/env.js` con valores reales;
- secret key;
- `service_role`;
- dumps con datos reales;
- credenciales de usuarios;
- tokens de acceso;
- archivos `.env` con secretos.

`js/env.example.js` sí se versiona como plantilla. `js/env.js` debe generarse en cada entorno o mantenerse localmente fuera del repositorio.

## Uso con Vercel sin build process

En un sitio estático puro, Vercel no reemplaza variables dentro de archivos JS automáticamente. Por eso existe `js/env.js`. Si `js/env.js` no existe o conserva placeholders, la app no conecta a Supabase y no usa fallback automático.

Como Vercel usara `html` como Root Directory, el build se ejecuta desde esta carpeta y el script escribe directamente `js/env.js`.

Configurar estas variables publicas en Vercel Staging:

```text
APP_ENV=staging
SUPABASE_URL=<Project URL staging>
SUPABASE_PUBLISHABLE_KEY=<Publishable Key staging>
```

Build Command en Vercel Staging:

```text
npm run build
```

Ese comando ejecuta `node scripts/generate-env.js` y genera `js/env.js` durante el despliegue. El script exige las tres variables publicas y rechaza variables o valores con `service_role`, `sb_secret`, Secret Key, JWT Secret o claves privadas.

Para cada entorno se puede:

1. Crear un `js/env.js` específico durante el deploy.
2. Usar una plantilla como `js/env.example.js`.
3. Mantener los valores reales configurados en el panel de Vercel y generar `js/env.js` con un paso previo al deploy.

## Uso con Vercel si luego se agrega build process

Si más adelante se agrega Vite, Next.js u otro build process, se puede migrar a variables de entorno:

- `VITE_APP_ENV`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

o sus equivalentes según el framework.

Importante: solo exponer variables públicas. En frontend no deben existir secrets.

## Cómo volver a producción

Para volver a producción:

1. Cambiar a rama `main`.
2. Verificar que el `js/env.js` local/deploy de producción tenga `APP_ENV: "production"` y la URL de producción.
3. Confirmar en consola:

```js
window.fitControlEnvironment
```

4. Validar que `supabaseUrl` sea la URL del proyecto Supabase producción.

## Checklist rápido antes de probar staging

- [ ] Rama actual: `mejoras-finales-frontend`.
- [ ] `APP_ENV` en `js/env.js`: `staging`.
- [ ] `SUPABASE_URL`: URL del proyecto staging.
- [ ] `SUPABASE_PUBLISHABLE_KEY`: publishable key staging.
- [ ] No hay `service_role`.
- [ ] No hay secret key.
- [ ] Login probado con usuarios de prueba.
