/**
 * Genera config.js en el deploy (Vercel) desde variables de entorno.
 * En local no sobrescribe un config.js que ya exista.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "config.js");

const onVercel = process.env.VERCEL === "1";

if (!onVercel && fs.existsSync(target)) {
  console.log("write-config: se mantiene config.js existente (desarrollo local).");
  process.exit(0);
}

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? "";

const body = `/* Generado en build (Vercel o npm run build). No edites en producción. */
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;

fs.writeFileSync(target, body, "utf8");
console.log(
  onVercel
    ? "write-config: config.js escrito desde variables de entorno."
    : "write-config: creado config.js (vacío o desde env). Copia desde config.example.js si hace falta."
);
