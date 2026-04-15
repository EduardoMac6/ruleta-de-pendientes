import { supabase } from "./supabase-client.js";
import { getVerifiedUser } from "./auth.js";

/**
 * @param {import("@supabase/supabase-js").PostgrestError | Error | null} err
 */
export function formatActivityError(err) {
  if (!err) return "";
  const msg = ("message" in err && err.message) || String(err);
  const low = msg.toLowerCase();
  if (
    ("code" in err && err.code === "42501") ||
    low.includes("permission denied") ||
    low.includes("rls") ||
    low.includes("policy")
  ) {
    return "No se pudo guardar la actividad: permisos insuficientes. Inicia sesión de nuevo.";
  }
  return msg || "Error al registrar actividad.";
}

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} [payload]
 */
export async function addActivityEvent(eventType, payload = {}) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase no configurado.") };
  }
  const { user, error: userErr } = await getVerifiedUser();
  if (userErr || !user) {
    return { data: null, error: userErr ?? new Error("Sesión no válida.") };
  }

  const { data, error } = await supabase
    .from("activity_events")
    .insert({
      user_id: user.id,
      event_type: eventType,
      payload: payload && typeof payload === "object" ? payload : {},
    })
    .select("id");

  return { data: Array.isArray(data) && data[0] ? data[0] : null, error };
}

/**
 * @param {number} [limit]
 */
export async function getMyActivityEvents(limit = 50) {
  if (!supabase) {
    return { data: [], error: new Error("Supabase no configurado.") };
  }
  const { user, error: userErr } = await getVerifiedUser();
  if (userErr || !user) {
    return { data: [], error: userErr ?? new Error("Sesión no válida.") };
  }

  const { data, error } = await supabase
    .from("activity_events")
    .select("id, event_type, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  return { data: data ?? [], error };
}

export async function getMyActivityScore() {
  if (!supabase) {
    return { score: null, error: new Error("Supabase no configurado.") };
  }
  const { user, error: userErr } = await getVerifiedUser();
  if (userErr || !user) {
    return { score: null, error: userErr ?? new Error("Sesión no válida.") };
  }

  const { data, error } = await supabase.rpc("user_activity_score");
  if (error) {
    return { score: null, error };
  }
  const n = Number(data);
  return { score: Number.isFinite(n) ? n : null, error: null };
}

