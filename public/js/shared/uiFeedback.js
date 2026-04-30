let installed = false;
let activeLoader = null;
let loaderInterval = null;

/** When SSE is quiet, creep toward ~82% so the bar is not stuck at 6%. */
function syntheticIdleProgress(elapsedSec) {
  const base = 6;
  const ceiling = 82;
  const tau = 34;
  return base + (ceiling - base) * (1 - Math.exp(-elapsedSec / tau));
}

export function installFeedback() {
  if (installed) return;
  installed = true;

  injectFeedbackStyles();

  window.alert = message => {
    showToast(String(message || ""), "info");
  };
}

export function showToast(message, type = "info", duration = 3200) {
  injectFeedbackStyles();

  let stack = document.getElementById("efToastStack");

  if (!stack) {
    stack = document.createElement("div");
    stack.id = "efToastStack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `ef-toast ef-toast-${type}`;

  toast.innerHTML = `
    <div class="ef-toast-icon">
      ${type === "success" ? "✓" : type === "danger" ? "!" : "i"}
    </div>

    <div class="ef-toast-message">
      ${escapeHTML(message)}
    </div>

    <button class="ef-toast-close" type="button">×</button>
  `;

  stack.appendChild(toast);

  const close = () => {
    toast.classList.add("ef-toast-out");
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector(".ef-toast-close")?.addEventListener("click", close);
  setTimeout(close, duration);
}

export function showNotice({
  title = "Notice",
  message = "",
  variant = "info",
  buttonText = "OK"
}) {
  injectFeedbackStyles();

  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "ef-feedback-overlay";

    overlay.innerHTML = `
      <div class="ef-feedback-modal card">
        <div class="ef-feedback-badge ef-feedback-${variant}">
          ${variant === "success" ? "✓" : variant === "danger" ? "!" : "i"}
        </div>

        <h2>${escapeHTML(title)}</h2>

        <p class="muted" style="margin-top:10px;">
          ${escapeHTML(message)}
        </p>

        <div class="row" style="justify-content:flex-end; margin-top:22px;">
          <button id="efNoticeOk" class="btn" type="button">
            ${escapeHTML(buttonText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const finish = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector("#efNoticeOk")?.addEventListener("click", finish);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish();
    });
  });
}

export function showConfirm({
  title = "Confirm",
  message = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false
}) {
  injectFeedbackStyles();

  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "ef-feedback-overlay";

    overlay.innerHTML = `
      <div class="ef-feedback-modal card">
        <div class="ef-feedback-badge ${danger ? "ef-feedback-danger" : "ef-feedback-info"}">
          ${danger ? "!" : "?"}
        </div>

        <h2>${escapeHTML(title)}</h2>

        <p class="muted" style="margin-top:10px;">
          ${escapeHTML(message)}
        </p>

        <div class="row" style="justify-content:flex-end; margin-top:22px;">
          <button id="efConfirmCancel" class="btn btn-secondary" type="button">
            ${escapeHTML(cancelText)}
          </button>

          <button id="efConfirmOk" class="btn" type="button">
            ${escapeHTML(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = value => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector("#efConfirmCancel")?.addEventListener("click", () => close(false));
    overlay.querySelector("#efConfirmOk")?.addEventListener("click", () => close(true));

    overlay.addEventListener("click", event => {
      if (event.target === overlay) close(false);
    });
  });
}

export function showLoadingOverlay({
  title = "Forging your arena...",
  message = "Preparing your quiz.",
  steps = [
    "Reading document",
    "Extracting concepts",
    "Generating challenges",
    "Checking quality",
    "Building arena"
  ]
} = {}) {
  injectFeedbackStyles();
  hideLoadingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "efLoadingOverlay";
  overlay.className = "ef-loading-overlay";

  overlay.innerHTML = `
    <div class="ef-loading-card card">
      <div class="ef-loading-orb">
        <span style="font-size:18px;font-weight:950;">AI</span>
      </div>

      <p class="eyebrow">ExamForge AI</p>

      <h2 id="efLoadingTitle">${escapeHTML(title)}</h2>

      <p id="efLoadingMessage" class="muted" style="margin-top:10px;">
        ${escapeHTML(message)}
      </p>

      <div class="ef-loading-progress">
        <div id="efLoadingBar" class="ef-loading-bar"></div>
      </div>

      <div id="efLoadingPercent" class="ef-loading-percent">6%</div>

      <div class="ef-loading-steps">
        ${steps
          .map((step, index) => {
            return `
              <div class="ef-loading-step ${index === 0 ? "active" : ""}" data-loading-step="${index}">
                <span>${index + 1}</span>
                <strong>${escapeHTML(step)}</strong>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  activeLoader = {
    overlay,
    progress: 6,
    anchorProgress: 6,
    loadStartedAt: Date.now(),
    step: 0,
    steps
  };

  if (loaderInterval) {
    clearInterval(loaderInterval);
    loaderInterval = null;
  }
  loaderInterval = setInterval(() => refreshLoadingDisplay(), 110);

  setLoadingStep(0);
  refreshLoadingDisplay();

  return activeLoader;
}

export function updateLoadingOverlay(message, progress) {
  if (!activeLoader) return;

  const messageEl = document.getElementById("efLoadingMessage");

  if (messageEl && message) {
    messageEl.textContent = message;
  }

  if (typeof progress === "number") {
    setLoadingProgress(progress);
    return;
  }

  const text = String(message || "").toLowerCase();
  const n = activeLoader.steps.length;
  // Target progress bands per step (0..n-1) so bar and numbered list stay aligned
  const band = index => {
    const lo = (index / n) * 100;
    const hi = ((index + 1) / n) * 100 - 1;
    return { lo, hi: Math.max(lo + 2, hi) };
  };

  const anchor = activeLoader.anchorProgress ?? activeLoader.progress;

  let targetPct = anchor;

  if (text.includes("read") || text.includes("cit") || text.includes("document") || text.includes("upload")) {
    targetPct = Math.max(anchor, band(0).hi);
  } else if (text.includes("concept") || text.includes("extract") || text.includes("research")) {
    targetPct = Math.max(anchor, band(1).hi);
  } else if (text.includes("gener") || text.includes("challeng") || text.includes("forging")) {
    targetPct = Math.max(anchor, band(2).hi);
  } else if (
    text.includes("still") &&
    (text.includes("challenge") || text.includes("creating") || text.includes("repair") || text.includes("working"))
  ) {
    targetPct = Math.max(anchor, Math.min(88, anchor + 4));
  } else if (
    text.includes("quality") ||
    text.includes("verific") ||
    text.includes("repair") ||
    text.includes("checking question") ||
    text.includes("unclear")
  ) {
    targetPct = Math.max(anchor, band(3).hi);
  } else if (
    text.includes("room") ||
    text.includes("lobby") ||
    text.includes("arena") ||
    text.includes("creating") ||
    text.includes("joining") ||
    text.includes("opening")
  ) {
    targetPct = Math.max(anchor, Math.min(99, band(n - 1).hi));
  }

  setLoadingProgress(Math.min(99, targetPct));
}

export function hideLoadingOverlay() {
  if (loaderInterval) {
    clearInterval(loaderInterval);
    loaderInterval = null;
  }

  const overlay = document.getElementById("efLoadingOverlay");

  if (overlay) {
    overlay.classList.add("ef-loading-out");
    setTimeout(() => overlay.remove(), 180);
  }

  activeLoader = null;
}

function setLoadingProgress(value) {
  if (!activeLoader) return;

  const v = Math.max(0, Math.min(100, value));
  activeLoader.anchorProgress = Math.max(activeLoader.anchorProgress ?? 6, v);

  refreshLoadingDisplay();
}

/**
 * Bar shows max(anchor, time-based idle curve). Step pills track displayed % so they match the bar.
 */
function refreshLoadingDisplay() {
  if (!activeLoader) return;

  const anchor = activeLoader.anchorProgress ?? 6;
  const elapsedSec = (Date.now() - (activeLoader.loadStartedAt || Date.now())) / 1000;
  const syn = syntheticIdleProgress(elapsedSec);
  const display = Math.min(100, Math.max(anchor, syn));

  activeLoader.progress = display;

  const bar = document.getElementById("efLoadingBar");
  const percent = document.getElementById("efLoadingPercent");

  if (bar) {
    bar.style.width = `${display}%`;
  }

  if (percent) {
    percent.textContent = `${Math.round(display)}%`;
  }

  setLoadingStepByProgress(display);
}

function setLoadingStep(index) {
  if (!activeLoader) return;

  activeLoader.step = Math.max(0, Math.min(activeLoader.steps.length - 1, index));

  document.querySelectorAll("[data-loading-step]").forEach(item => {
    const itemIndex = Number(item.dataset.loadingStep);
    item.classList.toggle("done", itemIndex < activeLoader.step);
    item.classList.toggle("active", itemIndex === activeLoader.step);
  });
}

function setLoadingStepByProgress(progress) {
  if (!activeLoader) return;

  const n = activeLoader.steps.length;
  if (n <= 0) return;

  // Step i active while progress is in [i/n * 100, (i+1)/n * 100)
  const idx = Math.min(
    n - 1,
    Math.floor((progress / 100) * n)
  );

  setLoadingStep(idx);
}

function injectFeedbackStyles() {
  if (document.getElementById("ef-feedback-styles")) return;

  const style = document.createElement("style");
  style.id = "ef-feedback-styles";

  style.textContent = `
    #efToastStack {
      position: fixed;
      top: 22px;
      right: 22px;
      z-index: 10000;
      display: grid;
      gap: 12px;
      width: min(390px, calc(100vw - 44px));
    }

    .ef-toast {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border: 3px solid var(--text, #111);
      border-radius: 16px;
      background: var(--paper, #fffaf0);
      color: var(--text, #111);
      box-shadow: 5px 5px 0 var(--text, #111);
      animation: efToastIn 0.18s ease-out;
      font-weight: 800;
    }

    .ef-toast-out {
      animation: efToastOut 0.18s ease-in forwards;
    }

    .ef-toast-icon,
    .ef-feedback-badge {
      width: 34px;
      height: 34px;
      border: 3px solid var(--text, #111);
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-weight: 950;
      background: #fff;
    }

    .ef-toast-success .ef-toast-icon,
    .ef-feedback-success {
      background: #b8ffce;
    }

    .ef-toast-danger .ef-toast-icon,
    .ef-feedback-danger {
      background: #ffb8b8;
    }

    .ef-toast-info .ef-toast-icon,
    .ef-feedback-info {
      background: #b8d7ff;
    }

    .ef-toast-close {
      border: 0;
      background: transparent;
      font-size: 24px;
      font-weight: 950;
      cursor: pointer;
      color: var(--text, #111);
    }

    .ef-feedback-overlay,
    .ef-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(0, 0, 0, 0.55);
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .ef-feedback-modal {
      width: min(520px, calc(100vw - 48px));
      animation: efModalIn 0.18s ease-out;
    }

    .ef-loading-card {
      width: min(720px, calc(100vw - 48px));
      position: relative;
      overflow: hidden;
      animation: efModalIn 0.18s ease-out;
    }

    .ef-loading-card::before {
      content: "";
      position: absolute;
      inset: -80px;
      background:
        radial-gradient(circle at 20% 20%, rgba(167, 139, 250, 0.3), transparent 26%),
        radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.22), transparent 26%),
        radial-gradient(circle at 50% 80%, rgba(134, 239, 172, 0.18), transparent 26%);
      pointer-events: none;
      animation: efFloatBg 5s ease-in-out infinite alternate;
    }

    .ef-loading-card > * {
      position: relative;
      z-index: 1;
    }

    .ef-loading-orb {
      width: 76px;
      height: 76px;
      border: 4px solid var(--text, #111);
      border-radius: 24px;
      display: grid;
      place-items: center;
      background: var(--accent, #facc15);
      box-shadow: 6px 6px 0 var(--text, #111);
      margin-bottom: 18px;
      animation: efOrbBounce 1.15s ease-in-out infinite;
    }

    .ef-loading-orb span {
      font-size: 34px;
    }

    .ef-loading-progress {
      margin-top: 22px;
      height: 24px;
      border: 3px solid var(--text, #111);
      border-radius: 999px;
      overflow: hidden;
      background: white;
      box-shadow: 4px 4px 0 var(--text, #111);
    }

    .ef-loading-bar {
      height: 100%;
      width: 8%;
      background: linear-gradient(90deg, #a78bfa, #38bdf8, #86efac);
      transition: width 0.48s cubic-bezier(0.33, 1, 0.68, 1);
    }

    .ef-loading-percent {
      margin-top: 10px;
      font-weight: 950;
      text-align: right;
    }

    .ef-loading-steps {
      display: grid;
      gap: 10px;
      margin-top: 20px;
    }

    .ef-loading-step {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 10px;
      opacity: 0.56;
      transform: translateX(0);
      transition: 0.18s ease;
    }

    .ef-loading-step span {
      width: 30px;
      height: 30px;
      border: 3px solid var(--text, #111);
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-weight: 950;
      background: white;
    }

    .ef-loading-step.active {
      opacity: 1;
      transform: translateX(8px);
    }

    .ef-loading-step.active span {
      background: #fde68a;
    }

    .ef-loading-step.done {
      opacity: 0.8;
    }

    .ef-loading-step.done span {
      background: #b8ffce;
    }

    .ef-loading-out {
      animation: efLoadingOut 0.18s ease-in forwards;
    }

    html.ef-dark .ef-toast,
    html.ef-dark .ef-feedback-modal,
    html.ef-dark .ef-loading-card {
      background: var(--paper, #1f2937) !important;
      color: var(--text, #f8fafc) !important;
    }

    html.ef-dark .ef-loading-progress {
      background: #0f172a;
    }

    html.ef-dark .ef-loading-step span,
    html.ef-dark .ef-toast-icon,
    html.ef-dark .ef-feedback-badge {
      color: #111827;
    }

    @keyframes efToastIn {
      from { transform: translateX(16px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes efToastOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(16px); opacity: 0; }
    }

    @keyframes efModalIn {
      from { transform: translateY(10px) scale(0.98); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    @keyframes efLoadingOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    @keyframes efOrbBounce {
      0%, 100% { transform: rotate(-3deg) translateY(0); }
      50% { transform: rotate(3deg) translateY(-8px); }
    }

    @keyframes efFloatBg {
      from { transform: translate(-10px, -6px); }
      to { transform: translate(10px, 6px); }
    }

    @media (max-width: 720px) {
      #efToastStack {
        top: 14px;
        right: 14px;
        width: calc(100vw - 28px);
      }

      .ef-loading-card,
      .ef-feedback-modal {
        width: calc(100vw - 32px);
      }
    }
  `;

  document.head.appendChild(style);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}