let installed = false;

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

    .ef-feedback-overlay {
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

    @media (max-width: 720px) {
      #efToastStack {
        top: 14px;
        right: 14px;
        width: calc(100vw - 28px);
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