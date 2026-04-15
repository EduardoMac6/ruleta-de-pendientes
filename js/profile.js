import { supabase } from "./supabase-client.js";
import { getVerifiedUser } from "./auth.js";

/**
 * @param {import("@supabase/supabase-js").PostgrestError | Error | null} err
 */
export function formatProfileError(err) {
  if (!err) return "";
  const msg = ("message" in err && err.message) || String(err);
  const code = "code" in err ? err.code : "";

  if (code === "PGRST116" || msg.includes("0 rows")) {
    return "No se encontró tu perfil. Si acabas de registrarte, espera un momento o vuelve a iniciar sesión.";
  }
  if (
    code === "42501" ||
    msg.toLowerCase().includes("permission denied") ||
    msg.toLowerCase().includes("rls") ||
    msg.toLowerCase().includes("policy")
  ) {
    return "No tienes permiso para esta acción en el perfil. Comprueba que iniciaste sesión correctamente.";
  }
  return msg || "No se pudo actualizar el perfil.";
}

export async function getMyProfile() {
  if (!supabase) {
    return { data: null, error: new Error("Supabase no configurado.") };
  }
  const { user, error: userErr } = await getVerifiedUser();
  if (userErr || !user) {
    return { data: null, error: userErr ?? new Error("Sesión no válida.") };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return { data, error };
}

/**
 * @param {string} display_name
 */
export async function updateMyProfile(display_name) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase no configurado.") };
  }
  const { user, error: userErr } = await getVerifiedUser();
  if (userErr || !user) {
    return { data: null, error: userErr ?? new Error("Sesión no válida.") };
  }

  const name = (display_name || "").trim().slice(0, 120);
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id)
    .select("id, display_name, updated_at")
    .maybeSingle();

  return { data, error };
}

