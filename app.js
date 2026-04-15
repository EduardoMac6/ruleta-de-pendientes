import {
  observeAuthChanges,
  sendPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from "./auth.js";
import { formatProfileError, getMyProfile, updateMyProfile } from "./profile.js";
import {
  addActivityEvent,
  formatActivityError,
  getMyActivityEvents,
  getMyActivityScore,
} from "./activity.js";
import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const GUEST_LS_KEY = "ruleta_guest_activities";

const authModal = document.getElementById("auth-modal");
const authClose = document.getElementById("auth-close");
const authError = document.getElementById("auth-error");
const authInfo = document.getElementById("auth-info");
const authSupabaseHint = document.getElementById("auth-supabase-hint");
const authTabSignin = document.getElementById("auth-tab-signin");
const authTabSignup = document.getElementById("auth-tab-signup");
const authPanelSignin = document.getElementById("auth-panel-signin");
const authPanelSignup = document.getElementById("auth-panel-signup");
const formSignin = document.getElementById("form-signin");
const formSignup = document.getElementById("form-signup");
const authEmailIn = document.getElementById("auth-email-in");
const authPassIn = document.getElementById("auth-pass-in");
const authForgotPass = document.getElementById("auth-forgot-pass");
const authEmailUp = document.getElementById("auth-email-up");
const authPassUp = document.getElementById("auth-pass-up");
const authDisplayUp = document.getElementById("auth-display-up");
const btnTogglePassIn = document.getElementById("btn-toggle-pass-in");
const eyeIconIn = document.getElementById("eye-icon-in");
const btnTogglePassUp = document.getElementById("btn-toggle-pass-up");
const eyeIconUp = document.getElementById("eye-icon-up");

const btnOpenSignin = document.getElementById("btn-open-signin");
const btnOpenSignup = document.getElementById("btn-open-signup");
const btnSignOut = document.getElementById("btn-sign-out");
const accountStatus = document.getElementById("account-status");
const accountEmail = document.getElementById("account-email");
const accountScoreWrap = document.getElementById("account-score-wrap");
const scoreValue = document.getElementById("score-value");
const historyDetails = document.getElementById("history-details");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const sessionLocalBanner = document.getElementById("session-local-banner");
const accountCloudMsg = document.getElementById("account-cloud-msg");

const profileCard = document.getElementById("profile-card");
const profileDisplayInput = document.getElementById("profile-display-input");
const profileSaveBtn = document.getElementById("profile-save-btn");
const profileMsg = document.getElementById("profile-msg");

/** @type {{ user: { id: string; email?: string | null } } | null} */
let currentSession = null;
let showedLocalBannerForSession = false;

function setAuthError(msg) {
  if (!msg) {
    authError.hidden = true;
    authError.textContent = "";
    return;
  }
  authError.hidden = false;
  authError.textContent = msg;
}

function setAuthInfo(msg) {
  if (!msg) {
    authInfo.hidden = true;
    authInfo.textContent = "";
    return;
  }
  authInfo.hidden = false;
  authInfo.textContent = msg;
}

function setCloudMsg(msg) {
  if (!accountCloudMsg) return;
  if (!msg) {
    accountCloudMsg.hidden = true;
    accountCloudMsg.textContent = "";
    return;
  }
  accountCloudMsg.hidden = false;
  accountCloudMsg.textContent = msg;
}

function setProfileMsg(msg, isError) {
  if (!profileMsg) return;
  if (!msg) {
    profileMsg.hidden = true;
    profileMsg.textContent = "";
    profileMsg.classList.remove("is-error", "is-success");
    return;
  }
  profileMsg.hidden = false;
  profileMsg.textContent = msg;
  profileMsg.classList.toggle("is-error", Boolean(isError));
  profileMsg.classList.toggle("is-success", !isError);
}

function showSessionLocalBanner() {
  if (!currentSession || showedLocalBannerForSession) return;
  showedLocalBannerForSession = true;
  sessionLocalBanner.textContent =
    "Tus pendientes en este dispositivo se guardan solo aquí (modo invitado). La puntuación y el historial van con tu cuenta en la nube.";
  sessionLocalBanner.hidden = false;
}

function loadGuestActivitiesFromStorage() {
  try {
    const raw = localStorage.getItem(GUEST_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && x.trim()).map((x) => x.slice(0, 120));
  } catch {
    return [];
  }
}

function saveGuestActivitiesToStorage(activities) {
  if (currentSession) return;
  try {
    localStorage.setItem(GUEST_LS_KEY, JSON.stringify(activities));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
function truncateLabel(text) {
  const t = (text || "").trim();
  return t.length > 120 ? t.slice(0, 117) + "…" : t;
}

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 */
async function logActivityEvent(eventType, payload) {
  if (!supabase || !currentSession?.user?.id) return;
  const { error } = await addActivityEvent(eventType, payload || {});
  if (error) {
    setCloudMsg(formatActivityError(error));
  } else {
    setCloudMsg("");
  }
  await loadHistoryAndScore();
}

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 */
function formatHistoryLine(eventType, payload) {
  const pl = payload && typeof payload === "object" ? payload : {};
  const label = typeof pl.label === "string" ? pl.label : "";
  const respiro = pl.respiro === true;
  switch (eventType) {
    case "spin":
      return respiro ? "Giro — plot twist" : `Giro — pendiente${label ? `: ${truncateLabel(label)}` : ""}`;
    case "respiro_shown":
      return pl.text ? `Plot twist: ${truncateLabel(String(pl.text))}` : "Plot twist mostrado";
    case "task_completed":
      return `Hecho: ${truncateLabel(label) || "(pendiente)"}`;
    case "task_added":
      return `Añadido: ${truncateLabel(label)}`;
    case "task_removed":
      return `Quitado: ${truncateLabel(label)}`;
    default:
      return eventType;
  }
}

async function loadHistoryAndScore() {
  if (!supabase || !currentSession?.user?.id) {
    scoreValue.textContent = "0";
    accountScoreWrap.hidden = true;
    historyDetails.hidden = true;
    historyList.innerHTML = "";
    historyEmpty.hidden = true;
    setCloudMsg("");
    return;
  }

  scoreValue.textContent = "…";
  const [histRes, scoreRes] = await Promise.all([getMyActivityEvents(50), getMyActivityScore()]);
  const cloudParts = [];

  if (histRes.error) {
    cloudParts.push(formatActivityError(histRes.error));
    historyList.innerHTML = "";
    historyEmpty.hidden = false;
    historyEmpty.textContent = "No se pudo cargar el historial.";
  } else {
    const rows = histRes.data || [];
    historyList.innerHTML = "";
    if (rows.length === 0) {
      historyEmpty.hidden = false;
      historyEmpty.textContent = "Aún no hay eventos registrados.";
    } else {
      historyEmpty.hidden = true;
      for (const row of rows) {
        const li = document.createElement("li");
        li.className = "history-item";
        const time = document.createElement("time");
        time.className = "history-time";
        time.dateTime = row.created_at || "";
        time.textContent = row.created_at
          ? new Date(row.created_at).toLocaleString("es", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "";
        const desc = document.createElement("span");
        desc.className = "history-desc";
        desc.textContent = formatHistoryLine(row.event_type, row.payload || {});
        li.append(time, desc);
        historyList.appendChild(li);
      }
    }
  }

  if (scoreRes.error) {
    scoreValue.textContent = "—";
    cloudParts.push(scoreRes.error.message || "No se pudo cargar la puntuación (RPC).");
  } else {
    scoreValue.textContent = String(scoreRes.score ?? 0);
  }
  setCloudMsg(cloudParts.filter(Boolean).join(" "));
  accountScoreWrap.hidden = false;
  historyDetails.hidden = false;
}

async function refreshProfileFields() {
  if (!profileCard || !profileDisplayInput) return;
  if (!currentSession?.user) {
    profileCard.hidden = true;
    setProfileMsg("", false);
    return;
  }
  profileCard.hidden = false;
  const { data, error } = await getMyProfile();
  if (error) {
    profileDisplayInput.value = "";
    setProfileMsg(formatProfileError(error), true);
    return;
  }
  setProfileMsg("", false);
  profileDisplayInput.value = (data?.display_name || "").trim();
}

function updateAccountChrome() {
  const hasClient = Boolean(supabase);
  if (!isSupabaseConfigured || !hasClient) {
    authSupabaseHint.hidden = false;
    btnOpenSignin.disabled = true;
    btnOpenSignup.disabled = true;
    btnSignOut.hidden = true;
    accountStatus.textContent = "Modo invitado (sin Supabase)";
    accountEmail.hidden = true;
    accountScoreWrap.hidden = true;
    historyDetails.hidden = true;
    if (profileCard) profileCard.hidden = true;
    setCloudMsg("");
    return;
  }

  authSupabaseHint.hidden = true;
  btnOpenSignin.disabled = false;
  btnOpenSignup.disabled = false;

  if (currentSession?.user) {
    accountStatus.textContent = "Sesión iniciada";
    accountEmail.hidden = false;
    accountEmail.textContent = currentSession.user.email || "Cuenta";
    btnOpenSignin.hidden = true;
    btnOpenSignup.hidden = true;
    btnSignOut.hidden = false;
  } else {
    accountStatus.textContent = "Modo invitado";
    accountEmail.hidden = true;
    accountEmail.textContent = "";
    btnOpenSignin.hidden = false;
    btnOpenSignup.hidden = false;
    btnSignOut.hidden = true;
    accountScoreWrap.hidden = true;
    historyDetails.hidden = true;
    if (profileCard) profileCard.hidden = true;
  }
}

function openAuthModal(mode) {
  if (!supabase) return;
  setAuthError("");
  setAuthInfo("");
  if (mode === "signup") {
    switchAuthTab("signup");
  } else {
    switchAuthTab("signin");
  }
  if (authModal && typeof authModal.showModal === "function") {
    authModal.showModal();
    if (mode === "signup") authEmailUp.focus();
    else authEmailIn.focus();
  }
}

function closeAuthModal() {
  if (authModal && authModal.open) authModal.close();
}

/**
 * @param {"signin" | "signup"} tab
 */
function switchAuthTab(tab) {
  const isSignup = tab === "signup";
  authTabSignin.classList.toggle("is-active", !isSignup);
  authTabSignup.classList.toggle("is-active", isSignup);
  authTabSignin.setAttribute("aria-selected", isSignup ? "false" : "true");
  authTabSignup.setAttribute("aria-selected", isSignup ? "true" : "false");
  authPanelSignin.hidden = isSignup;
  authPanelSignup.hidden = !isSignup;
}

function wirePasswordToggle(btn, input, eyeEl) {
  btn.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    eyeEl.textContent = isPassword ? "🙈" : "👁️";
    btn.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
  });
}

wirePasswordToggle(btnTogglePassIn, authPassIn, eyeIconIn);
wirePasswordToggle(btnTogglePassUp, authPassUp, eyeIconUp);

authClose.addEventListener("click", closeAuthModal);
authModal.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeAuthModal();
});

authTabSignin.addEventListener("click", () => switchAuthTab("signin"));
authTabSignup.addEventListener("click", () => switchAuthTab("signup"));

btnOpenSignin.addEventListener("click", () => openAuthModal("signin"));
btnOpenSignup.addEventListener("click", () => openAuthModal("signup"));

formSignin.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  setAuthInfo("");
  if (!supabase) {
    setAuthError(
      "Supabase no está configurado: abre config.js junto a index.html y pega SUPABASE_URL y SUPABASE_ANON_KEY (copia desde config.example.js)."
    );
    return;
  }
  const email = authEmailIn.value.trim();
  const password = authPassIn.value;
  const { error } = await signInWithEmail(email, password);
  if (error) {
    setAuthError(error.message || "No se pudo iniciar sesión.");
    return;
  }
  closeAuthModal();
});

formSignup.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  setAuthInfo("");
  if (!supabase) {
    setAuthError(
      "Supabase no está configurado: abre config.js junto a index.html y pega SUPABASE_URL y SUPABASE_ANON_KEY (copia desde config.example.js)."
    );
    return;
  }
  const email = authEmailUp.value.trim();
  const password = authPassUp.value;
  const displayName = authDisplayUp ? authDisplayUp.value : "";
  const { error, infoMessage } = await signUpWithEmail(email, password, displayName);
  if (error) {
    setAuthError(error.message || "No se pudo crear la cuenta.");
    return;
  }
  if (infoMessage) {
    setAuthInfo(infoMessage);
    return;
  }
  setAuthInfo("Cuenta lista. Ya puedes usar el perfil.");
  closeAuthModal();
});

if (authForgotPass) {
  authForgotPass.addEventListener("click", async () => {
    if (!supabase) return;
    setAuthError("");
    setAuthInfo("");
    const email = authEmailIn.value.trim();
    if (!email) {
      setAuthError("Escribe tu correo arriba para enviarte el enlace de restablecimiento.");
      return;
    }
    const { error } = await sendPasswordReset(email);
    if (error) {
      setAuthError(error.message || "No se pudo enviar el correo.");
      return;
    }
    setAuthInfo("Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.");
  });
}

btnSignOut.addEventListener("click", async () => {
  if (!supabase) return;
  showedLocalBannerForSession = false;
  sessionLocalBanner.hidden = true;
  setCloudMsg("");
  setProfileMsg("", false);
  await signOut();
  if (typeof rouletteApi.reloadGuestList === "function") rouletteApi.reloadGuestList();
});

[authEmailIn, authPassIn, authEmailUp, authPassUp, authDisplayUp].forEach((el) => {
  if (el)
    el.addEventListener("input", () => {
      setAuthError("");
      setAuthInfo("");
    });
});

if (profileSaveBtn && profileDisplayInput) {
  profileSaveBtn.addEventListener("click", async () => {
    setProfileMsg("");
    profileSaveBtn.disabled = true;
    const { error } = await updateMyProfile(profileDisplayInput.value);
    profileSaveBtn.disabled = false;
    if (error) {
      setProfileMsg(formatProfileError(error), true);
      return;
    }
    setProfileMsg("Nombre guardado.", false);
  });
}

/** Roulette + list */
let rouletteApi = { reloadGuestList: () => {} };

function initRoulette() {
  const COLORS = [
    "#3d9cf5",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#fb7185",
    "#22d3ee",
    "#c084fc",
    "#4ade80",
    "#f97316",
    "#60a5fa",
  ];

  const RESPIRO_CHANCE = 0.22;

  const RESPIRO_ITEMS = [
    {
      text: "Ve por esa chela. La lista aguanta; tú no tanto.",
      src: "https://i.giphy.com/media/daAsPFgZkW9iM/giphy.gif",
    },
    {
      text: "El universo votó y ganó el sillón. Democracia representativa.",
      src: "https://i.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif",
    },
    {
      text: "Tu yo del mañana puede con eso. Hoy no es su día.",
      src: "https://i.giphy.com/media/xT4uQulxzV39haRFjG/giphy.gif",
    },
    {
      text: "Modo estrategia: si no lo ves, no existe. Filosofía de oficina.",
      src: "https://i.giphy.com/media/3o7aTskHEUdgCQAXde/giphy.gif",
    },
    {
      text: "Date 10 minutos de nada productivo. Vive sabroso.",
      src: "https://i.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
    },
    {
      text: "La culpa es del WiFi lento. Siempre ha sido el WiFi.",
      src: "https://i.giphy.com/media/14kdiJUblbWBXy/giphy.gif",
    },
    {
      text: "Pon un meme y di que fue investigación de mercado.",
      src: "https://i.giphy.com/media/FiGiRei2ICzzG/giphy.gif",
    },
    {
      text: "Si alguien pregunta, fue culpa nuestra. Ya quedó escrito.",
      src: "https://i.giphy.com/media/KXgJsSeOfvSgg/giphy.gif",
    },
    {
      text: "Respira. O suspira fuerte. Mismo efecto, más dramático.",
      src: "https://i.giphy.com/media/vLruErVSYGx8s/giphy.gif",
    },
    {
      text: "Ir por café cuenta como logística. Eres un genio operativo.",
      src: "https://i.giphy.com/media/m2Q7FEc0bEr4I/giphy.gif",
    },
    {
      text: "La productividad puede esperar; tu dignidad de no hacer nada, no.",
      src: "https://i.giphy.com/media/ETV4MRojrqsve/giphy.gif",
    },
    {
      text: "Abre el refri, cierra el refri. Eso fue cardio mental.",
      src: "https://i.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif",
    },
    {
      text: "Manda un sticker cursed a alguien que te aguante. Terapia low cost.",
      src: "https://i.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
    },
    {
      text: "Hoy el pendiente eres tú, descansando. Plot twist feliz.",
      src: "https://i.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif",
    },
    {
      text: "Una vueltita a la cuadra para que el cerebro crea que hiciste deporte.",
      src: "https://i.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif",
    },
  ];

  const els = {
    form: document.getElementById("add-form"),
    input: document.getElementById("activity-input"),
    list: document.getElementById("activity-list"),
    hint: document.getElementById("list-hint"),
    spin: document.getElementById("btn-spin"),
    canvas: document.getElementById("wheel"),
    result: document.getElementById("result"),
    tooltip: document.getElementById("wheel-tooltip"),
    wheelWrap: document.getElementById("wheel-wrap"),
    btnDone: document.getElementById("btn-done"),
    respiroVisual: document.getElementById("respiro-visual"),
    respiroImg: document.getElementById("respiro-img"),
  };

  let lastRespiroIndex = -1;

  /**
   * Lista en memoria: invitado + localStorage; con sesión, solo memoria (sin sync remoto).
   * Siguiente paso: tabla tipo public.tasks con RLS y reemplazar esta fuente por lectura/escritura Supabase.
   * @type {string[]}
   */
  let activities = currentSession?.user ? [] : loadGuestActivitiesFromStorage();

  let rotationDeg = 0;
  let spinning = false;
  let animId = null;
  /** @type {number | null} */
  let pendingDoneIndex = null;
  /** @type {string} */
  let pendingDoneText = "";

  const ctx = els.canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function persistListIfGuest() {
    saveGuestActivitiesToStorage(activities);
  }

  function relLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function drawWheel() {
    const w = els.canvas.width;
    const h = els.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 8;
    const n = activities.length;

    ctx.clearRect(0, 0, w, h);

    if (n === 0) {
      ctx.fillStyle = "#1a2332";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2d3a4d";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 16px DM Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Añade pendientes", cx, cy);
      return;
    }

    const slice = (2 * Math.PI) / n;

    for (let i = 0; i < n; i++) {
      const start = -Math.PI / 2 + i * slice;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 20, 25, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const mid = start + slice / 2;
      const labelR = r * 0.58;
      const tx = cx + Math.cos(mid) * labelR;
      const ty = cy + Math.sin(mid) * labelR;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      const num = String(i + 1);
      const sliceColor = COLORS[i % COLORS.length];
      const lum = relLuminance(sliceColor);
      ctx.fillStyle = lum > 0.55 ? "#0f1419" : "#ffffff";
      const fontPx = n > 12 ? 18 : n > 8 ? 22 : n > 5 ? 28 : 34;
      ctx.font = `700 ${fontPx}px DM Sans, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = lum > 0.55 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 2;
      ctx.fillText(num, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function renderList() {
    els.list.innerHTML = "";
    activities.forEach((text, index) => {
      const li = document.createElement("li");
      li.className = "activity-item";
      const num = document.createElement("span");
      num.className = "activity-num";
      num.textContent = `${index + 1}.`;
      const span = document.createElement("span");
      span.textContent = text;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-remove";
      rm.setAttribute("aria-label", `Quitar pendiente ${index + 1}: ${text}`);
      rm.textContent = "Quitar";
      rm.addEventListener("click", () => {
        if (spinning) return;
        const removed = activities[index];
        activities.splice(index, 1);
        clearPendingDone();
        renderList();
        drawWheel();
        syncSpinState();
        persistListIfGuest();
        void logActivityEvent("task_removed", { label: truncateLabel(removed) });
      });
      li.append(num, span, rm);
      els.list.appendChild(li);
    });
    syncSpinState();
  }

  function hideWheelTooltip() {
    els.tooltip.hidden = true;
    els.tooltip.classList.remove("is-visible");
    els.tooltip.textContent = "";
    els.tooltip.style.left = "";
    els.tooltip.style.top = "";
  }

  function updateWheelTooltip(clientX, clientY) {
    if (spinning || activities.length === 0) {
      hideWheelTooltip();
      return;
    }

    const rect = els.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const xd = clientX - cx;
    const yd = clientY - cy;
    const θ = (rotationDeg * Math.PI) / 180;
    const lx = xd * Math.cos(θ) - yd * Math.sin(θ);
    const ly = xd * Math.sin(θ) + yd * Math.cos(θ);

    const n = activities.length;
    const rDisp = Math.min(rect.width, rect.height) / 2 - 6;
    const dist = Math.hypot(lx, ly);
    if (dist < 18 || dist > rDisp) {
      hideWheelTooltip();
      return;
    }

    const angleCw = (Math.atan2(lx, -ly) + 2 * Math.PI) % (2 * Math.PI);
    const slice = (2 * Math.PI) / n;
    let idx = Math.floor(angleCw / slice);
    if (idx >= n) idx = n - 1;

    const label = String(idx + 1);
    const task = activities[idx];

    els.tooltip.replaceChildren();
    const numEl = document.createElement("span");
    numEl.className = "wheel-tooltip-num";
    numEl.textContent = `Nº ${label}`;
    const textEl = document.createElement("span");
    textEl.className = "wheel-tooltip-text";
    textEl.textContent = task;
    els.tooltip.append(numEl, textEl);
    els.tooltip.style.left = `${clientX}px`;
    els.tooltip.style.top = `${clientY}px`;
    els.tooltip.style.transform = "translate(-50%, -100%) translateY(-8px)";
    els.tooltip.hidden = false;
    requestAnimationFrame(() => {
      els.tooltip.classList.add("is-visible");
      const tipRect = els.tooltip.getBoundingClientRect();
      let left = clientX;
      let top = clientY - 12;
      const pad = 8;
      if (left - tipRect.width / 2 < pad) left = pad + tipRect.width / 2;
      if (left + tipRect.width / 2 > window.innerWidth - pad) {
        left = window.innerWidth - pad - tipRect.width / 2;
      }
      if (top - tipRect.height < pad) top = clientY + 24 + tipRect.height / 2;
      els.tooltip.style.left = `${left}px`;
      els.tooltip.style.top = `${top}px`;
      els.tooltip.style.transform = "translate(-50%, -100%) translateY(-8px)";
    });
  }

  function hideRespiroVisual() {
    els.respiroVisual.hidden = true;
    els.respiroImg.removeAttribute("src");
  }

  function showRespiroVisual(src) {
    if (!src || prefersReducedMotion) {
      hideRespiroVisual();
      return;
    }
    els.respiroImg.alt = "";
    els.respiroImg.src = src;
    els.respiroVisual.hidden = false;
  }

  function clearPendingDone() {
    pendingDoneIndex = null;
    pendingDoneText = "";
    els.btnDone.hidden = true;
  }

  function completePendingTask() {
    if (pendingDoneIndex === null || !pendingDoneText) return;
    const doneLabel = pendingDoneText;
    const idx =
      activities[pendingDoneIndex] === pendingDoneText
        ? pendingDoneIndex
        : activities.indexOf(pendingDoneText);
    if (idx !== -1) activities.splice(idx, 1);
    clearPendingDone();
    els.result.textContent = "";
    els.result.classList.remove("is-respiro");
    hideRespiroVisual();
    renderList();
    drawWheel();
    syncSpinState();
    persistListIfGuest();
    void logActivityEvent("task_completed", { label: truncateLabel(doneLabel) });
  }

  function syncSpinState() {
    const ok = activities.length >= 2;
    els.spin.disabled = !ok || spinning;
    els.hint.hidden = ok;
    els.canvas.setAttribute(
      "aria-label",
      activities.length ? `Ruleta con ${activities.length} pendientes` : "Ruleta vacía"
    );
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function spin() {
    if (spinning || activities.length < 2) return;

    const n = activities.length;
    const useRespiro = RESPIRO_ITEMS.length > 0 && Math.random() < RESPIRO_CHANCE;
    const winnerIndex = Math.floor(Math.random() * n);
    const sliceDeg = 360 / n;
    const margin = sliceDeg * 0.12;
    const landAngle =
      winnerIndex * sliceDeg + margin + Math.random() * (sliceDeg - 2 * margin);
    let spinAmount = ((-landAngle - rotationDeg) % 360 + 360) % 360;
    const minTurns = prefersReducedMotion ? 1 : 6;
    while (spinAmount < 360 * minTurns) spinAmount += 360;

    spinning = true;
    hideWheelTooltip();
    clearPendingDone();
    hideRespiroVisual();
    els.result.classList.remove("is-respiro");
    els.spin.classList.add("spinning");
    els.spin.disabled = true;
    els.result.textContent = "Eligiendo por ti…";
    els.result.setAttribute("aria-busy", "true");

    const start = rotationDeg;
    const end = rotationDeg + spinAmount;
    const duration = prefersReducedMotion ? 380 + Math.random() * 220 : 4800 + Math.random() * 800;
    const t0 = performance.now();

    if (animId) cancelAnimationFrame(animId);

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeOutCubic(t);
      rotationDeg = start + (end - start) * e;
      els.canvas.style.transform = `rotate(${rotationDeg}deg)`;

      if (t < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        rotationDeg = end;
        els.canvas.style.transform = `rotate(${rotationDeg}deg)`;
        spinning = false;
        els.spin.classList.remove("spinning");
        els.result.removeAttribute("aria-busy");
        if (useRespiro) {
          const item = pickRespiroItem();
          els.result.classList.add("is-respiro");
          els.result.textContent = "Plot twist — " + item.text;
          showRespiroVisual(item.src);
          els.btnDone.hidden = true;
          void logActivityEvent("spin", { respiro: true });
          void logActivityEvent("respiro_shown", { text: truncateLabel(item.text) });
        } else {
          els.result.classList.remove("is-respiro");
          hideRespiroVisual();
          const won = activities[winnerIndex];
          els.result.textContent = `Empieza por el nº ${winnerIndex + 1}: ${won}`;
          pendingDoneIndex = winnerIndex;
          pendingDoneText = won;
          els.btnDone.hidden = false;
          void logActivityEvent("spin", { respiro: false, label: truncateLabel(won) });
        }
        syncSpinState();
      }
    }

    animId = requestAnimationFrame(frame);
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = els.input.value.trim();
    if (!v || spinning) return;
    activities.push(v.slice(0, 120));
    els.input.value = "";
    renderList();
    drawWheel();
    persistListIfGuest();
    void logActivityEvent("task_added", { label: truncateLabel(v) });
  });

  function pickRespiroItem() {
    const n = RESPIRO_ITEMS.length;
    if (n === 0) return { text: "", src: "" };
    if (n === 1) return RESPIRO_ITEMS[0];
    let i = Math.floor(Math.random() * n);
    if (i === lastRespiroIndex) i = (i + 1) % n;
    lastRespiroIndex = i;
    return RESPIRO_ITEMS[i];
  }

  els.respiroImg.addEventListener("error", () => {
    hideRespiroVisual();
  });

  els.spin.addEventListener("click", spin);
  els.btnDone.addEventListener("click", completePendingTask);

  els.wheelWrap.addEventListener("pointermove", (e) => {
    updateWheelTooltip(e.clientX, e.clientY);
  });
  els.wheelWrap.addEventListener("pointerleave", hideWheelTooltip);
  els.wheelWrap.addEventListener("pointercancel", hideWheelTooltip);

  drawWheel();
  renderList();

  return {
    reloadGuestList() {
      if (currentSession) return;
      activities = loadGuestActivitiesFromStorage();
      clearPendingDone();
      hideRespiroVisual();
      els.result.textContent = "";
      els.result.classList.remove("is-respiro");
      rotationDeg = 0;
      els.canvas.style.transform = "rotate(0deg)";
      renderList();
      drawWheel();
      syncSpinState();
    },
  };
}

async function applyAuthSession(session) {
  currentSession = session;
  updateAccountChrome();
  if (session?.user) {
    showSessionLocalBanner();
    await refreshProfileFields();
    await loadHistoryAndScore();
  } else {
    showedLocalBannerForSession = false;
    sessionLocalBanner.hidden = true;
    if (profileCard) profileCard.hidden = true;
    await loadHistoryAndScore();
  }
}

let rouletteBootstrapped = false;

function ensureRoulette() {
  if (rouletteBootstrapped) return;
  rouletteBootstrapped = true;
  rouletteApi = initRoulette();
}

if (supabase) {
  observeAuthChanges((event, session) => {
    void (async () => {
      await applyAuthSession(session);
      if (event === "INITIAL_SESSION") {
        ensureRoulette();
      } else if (event === "SIGNED_OUT") {
        showedLocalBannerForSession = false;
        sessionLocalBanner.hidden = true;
        if (typeof rouletteApi.reloadGuestList === "function") rouletteApi.reloadGuestList();
      }
    })();
  });
} else {
  updateAccountChrome();
  void loadHistoryAndScore();
  ensureRoulette();
}
