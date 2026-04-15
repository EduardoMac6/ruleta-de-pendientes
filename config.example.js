/**
 * Copia este archivo como `config.js` (junto a index.html) y pega tus credenciales:
 * Supabase Dashboard → Settings → API → Project URL y anon public key.
 * No subas `config.js` con valores reales si el repo es público (suele estar en .gitignore).
 *
 * Vercel: en el proyecto define variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY
 * (Settings → Environment Variables). En cada deploy, `npm run build` genera config.js
 * en el servidor; así el GET /config.js deja de dar 404 y la app (ruleta incluida) arranca.
 *
 * Auth (confirmación y reset de contraseña):
 * Ajusta "Site URL" al dominio principal de la app (afecta enlaces de confirmación de email).
 * En Authentication → URL configuration, añade a "Redirect URLs" la URL exacta donde
 * vive la app, p. ej. http://localhost:3000/ y https://tu-dominio.vercel.app/
 * La app usa resetPasswordForEmail con redirectTo = origin + pathname (sin querystring).
 * Debe coincidir con una entrada permitida o el enlace del correo fallará.
 */
export const SUPABASE_URL = "";

export const SUPABASE_ANON_KEY = "";
