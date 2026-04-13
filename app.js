(function () {
  "use strict";

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

  /** Probabilidad de que, al parar el giro, salga un permiso en lugar de un pendiente. */
  const RESPIRO_CHANCE = 0.22;

  /**
   * Plot twists: texto + GIF (misma entrada = mismo par). Los GIFs son URLs directas;
   * puedes sustituir por archivos locales: `src: "assets/mi-meme.gif"`.
   */
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

  /** @type {number} */
  let lastRespiroIndex = -1;

  /** @type {string[]} */
  let activities = [];
  let rotationDeg = 0;
  let spinning = false;
  let animId = null;
  /** @type {number | null} */
  let pendingDoneIndex = null;
  /** @type {string} */
  let pendingDoneText = "";

  const ctx = els.canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /**
   * WCAG relative luminance for sRGB hex (e.g. #rrggbb).
   * @param {string} hex
   * @returns {number} 0–1
   */
  function relLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
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
        activities.splice(index, 1);
        clearPendingDone();
        renderList();
        drawWheel();
        syncSpinState();
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

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
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
    const useRespiro =
      RESPIRO_ITEMS.length > 0 && Math.random() < RESPIRO_CHANCE;
    const winnerIndex = Math.floor(Math.random() * n);
    const sliceDeg = 360 / n;
    const margin = sliceDeg * 0.12;
    const landAngle =
      winnerIndex * sliceDeg +
      margin +
      Math.random() * (sliceDeg - 2 * margin);
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
    const duration = prefersReducedMotion
      ? 380 + Math.random() * 220
      : 4800 + Math.random() * 800;
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
        } else {
          els.result.classList.remove("is-respiro");
          hideRespiroVisual();
          const won = activities[winnerIndex];
          els.result.textContent = `Empieza por el nº ${winnerIndex + 1}: ${won}`;
          pendingDoneIndex = winnerIndex;
          pendingDoneText = won;
          els.btnDone.hidden = false;
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
    activities.push(v);
    els.input.value = "";
    renderList();
    drawWheel();
  });

  /**
   * @returns {{ text: string, src: string }}
   */
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
})();
