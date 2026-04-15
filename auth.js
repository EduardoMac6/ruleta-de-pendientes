import { supabase } from "./supabase-client.js";

const MSG_NO_SUPABASE =
  "Añade SUPABASE_URL y SUPABASE_ANON_KEY en config.js (copia desde config.example.js).";

const MSG_CONFIRM_EMAIL =
  "Te registraste correctamente. Revisa tu correo y confirma tu cuenta antes de iniciar sesión.";

function noClientError() {
  return { message: MSG_NO_SUPABASE, name: "ConfigError" };
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 * @returns {Promise<{ data: import("@supabase/supabase-js").AuthResponse["data"] | null; error: Error | null; infoMessage: string | null }>}
 */
export async function signUpWithEmail(email, password, displayName) {
  if (!supabase) {
    return { data: null, error: /** @type {any} */ (noClientError()), infoMessage: null };
  }
  const trimmedName = (displayName || "").trim();
  const options =
    trimmedName.length > 0 ? { data: { display_name: trimmedName.slice(0, 120) } } : {};

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options,
  });

  if (error) {
    return { data: null, error, infoMessage: null };
  }

  if (data.session) {
    return { data, error: null, infoMessage: null };
  }

  return { data, error: null, infoMessage: MSG_CONFIRM_EMAIL };
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signInWithEmail(email, password) {
  if (!supabase) {
    return { user: null, session: null, error: /** @type {any} */ (noClientError()) };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    return { user: null, session: null, error };
  }
  const verified = await getVerifiedUser();
  if (verified.user) {
    return { user: verified.user, session: data.session, error: null };
  }
  if (data.session && data.user) {
    return { user: data.user, session: data.session, error: null };
  }
  return {
    user: null,
    session: data.session,
    error: verified.error ?? /** @type {any} */ (new Error("No se pudo verificar la sesión. Vuelve a intentar.")),
  };
}

export async function signOut() {
  if (!supabase) {
    return { error: /** @type {any} */ (noClientError()) };
  }
  return supabase.auth.signOut();
}

/** Usuario verificado con el servidor (JWT). */
export async function getVerifiedUser() {
  if (!supabase) {
    return { user: null, error: /** @type {any} */ (noClientError()) };
  }
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user ?? null, error };
}

/**
 * @param {string} email
 */
export async function sendPasswordReset(email) {
  if (!supabase) {
    return { error: /** @type {any} */ (noClientError()) };
  }
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}

/**
 * @param {(event: string, session: import("@supabase/supabase-js").Session | null) => void} callback
 */
export function observeAuthChanges(callback) {
  if (!supabase) {
    callback("INITIAL_SESSION", null);
    return { data: { subscription: { unsubscribe() {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}
