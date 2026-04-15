# Ruleta de pendientes

App estática (HTML + JS + CSS) con cuenta Supabase: perfil, historial de actividad y puntuación por RPC. La lista de la ruleta sigue en el navegador (local / invitado).

## Estructura del repo

| Ruta | Para qué sirve |
|------|----------------|
| `index.html` | Entrada; carga `app.js` como módulo |
| `app.js` | UI, ruleta, cableado auth + perfil + historial |
| `styles.css` | Estilos |
| `supabase-client.js` | Cliente Supabase (solo anon key) |
| `config.js` | **No está en git.** Credenciales locales o generado en Vercel |
| `config.example.js` | Plantilla + notas de URLs (confirmación / reset) |
| `auth.js` | Registro, login, logout, reset, `onAuthStateChange` |
| `profile.js` | Tabla `public.profiles` |
| `activity.js` | Tabla `activity_events` + RPC `user_activity_score` |
| `scripts/write-config.mjs` | Build: escribe `config.js` en deploy (Vercel) |
| `package.json` | `npm run build` → genera `config.js` |
| `vercel.json` | Build + servir desde la raíz del proyecto |
| `supabase/migrations/` | SQL de referencia (perfiles, eventos, RLS, trigger, RPC) |

## Setup local

1. Copia `config.example.js` → `config.js` en la misma carpeta que `index.html`.
2. Rellena `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Dashboard → Settings → API, clave **anon**).
3. Aplica la migración en tu proyecto Supabase (`supabase/migrations/001_initial_schema.sql`).
4. Sirve la carpeta con un servidor HTTP (no abras `index.html` como `file://` si fallan los módulos), por ejemplo: `npx serve .`

## Vercel

1. Variables de entorno del proyecto: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
2. Cada deploy ejecuta `npm run build`, que crea `config.js` en el servidor (evita 404 en `/config.js`).
3. En Supabase → Authentication → URL configuration: **Site URL** y **Redirect URLs** deben incluir tu dominio de Vercel (reset de contraseña usa `origin + pathname`).

## Git / ramas

- **`main`**: suele ser la rama “oficial” del remoto.
- **`Cursor`**: rama de trabajo con la integración Supabase y fixes recientes.

**Para ordenar:** cuando estés conforme, fusiona `Cursor` → `main` (PR en GitHub) y deja `main` como única rama de producción; sigue usando ramas cortas para features.

## Qué no subir

- `config.js` (en `.gitignore`).
- `.agents/`, `skills-lock.json` (solo máquina local / Cursor).

## Versión

La app muestra la versión en el footer del HTML (p. ej. V.2.3).
