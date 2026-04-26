let themeInstalled = false;

export function installThemeToggle() {
  if (themeInstalled) return;
  themeInstalled = true;

  injectThemeStyles();

  const savedTheme = localStorage.getItem("ef_theme") || "light";
  setTheme(savedTheme);

  if (document.getElementById("efThemeToggle")) return;

  const button = document.createElement("button");
  button.id = "efThemeToggle";
  button.type = "button";
  button.className = "ef-theme-toggle";
  button.setAttribute("aria-label", "Toggle dark mode");

  document.body.appendChild(button);
  updateThemeButton(button);

  button.addEventListener("click", () => {
    const nextTheme = document.documentElement.classList.contains("ef-dark")
      ? "light"
      : "dark";

    setTheme(nextTheme);
    updateThemeButton(button);
  });
}

export function setTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";

  document.documentElement.classList.toggle("ef-dark", normalized === "dark");
  document.body?.classList.toggle("ef-dark", normalized === "dark");

  localStorage.setItem("ef_theme", normalized);
}

function updateThemeButton(button) {
  const isDark = document.documentElement.classList.contains("ef-dark");
  button.innerHTML = isDark ? "☀️ Light" : "🌙 Dark";
}

function injectThemeStyles() {
  if (document.getElementById("ef-theme-styles")) return;

  const style = document.createElement("style");
  style.id = "ef-theme-styles";

  style.textContent = `
    :root {
      color-scheme: light;
    }

    html.ef-dark {
      color-scheme: dark;

      --bg: #08111f;
      --paper: #101b2d;
      --surface: #0d1728;
      --surface-2: #142238;
      --surface-3: #1d2f4a;

      --text: #e7eefc;
      --muted: #9fb0c8;

      --border: #263955;
      --shadow: #020617;

      --accent: #3b82f6;
      --accent-2: #14b8a6;
      --accent-soft: #1e3a8a;

      --success: #166534;
      --success-soft: #123524;

      --danger: #7f1d1d;
      --danger-soft: #3b1114;

      --warning: #854d0e;
      --warning-soft: #3a2610;
    }

    html.ef-dark body {
      background:
        radial-gradient(circle at 12% 8%, rgba(30, 58, 138, 0.34), transparent 34%),
        radial-gradient(circle at 88% 18%, rgba(20, 184, 166, 0.16), transparent 28%),
        radial-gradient(circle at 50% 100%, rgba(15, 23, 42, 0.92), transparent 38%),
        var(--bg) !important;
      color: var(--text) !important;
    }

    html.ef-dark .card,
    html.ef-dark .flat-card,
    html.ef-dark .auth-card,
    html.ef-dark .challenge-card,
    html.ef-dark .lobby-card,
    html.ef-dark .leaderboard-card,
    html.ef-dark .ef-feedback-modal,
    html.ef-dark .ef-loading-card,
    html.ef-dark .ef-invite-modal,
    html.ef-dark .ef-friends-modal,
    html.ef-dark .ef-history-modal {
      background: linear-gradient(180deg, var(--surface-2), var(--paper)) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 8px 8px 0 var(--shadow) !important;
    }

    html.ef-dark .dash-session-row,
    html.ef-dark .friend-row,
    html.ef-dark .dash-stat,
    html.ef-dark .stat-card,
    html.ef-dark .ef-history-details-card,
    html.ef-dark .ef-answer-review,
    html.ef-dark .ef-document-box {
      background: #0f1b2e !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .dash-session-row:hover {
      background: #16243a !important;
    }

    html.ef-dark .muted,
    html.ef-dark .dash-stat-label,
    html.ef-dark .ef-loading-step {
      color: var(--muted) !important;
    }

    html.ef-dark h1,
    html.ef-dark h2,
    html.ef-dark h3,
    html.ef-dark strong,
    html.ef-dark label {
      color: var(--text) !important;
    }

    html.ef-dark input,
    html.ef-dark textarea,
    html.ef-dark select {
      background: #07111f !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark input::placeholder,
    html.ef-dark textarea::placeholder {
      color: #71839f !important;
    }

    html.ef-dark .btn {
      background: linear-gradient(180deg, #60a5fa, #2563eb) !important;
      color: #f8fafc !important;
      border-color: #1e3a8a !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .btn:hover {
      filter: brightness(1.06);
    }

    html.ef-dark .btn.btn-secondary {
      background: #111f34 !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .mode-option,
    html.ef-dark .auth-tab,
    html.ef-dark .option-card,
    html.ef-dark .answer-option,
    html.ef-dark .choice-card {
      background: #0f1b2e !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .mode-option.selected,
    html.ef-dark .auth-tab-active,
    html.ef-dark .selected,
    html.ef-dark .choice-card.selected,
    html.ef-dark .answer-option.selected {
      background: #1e3a8a !important;
      color: #eff6ff !important;
      border-color: #60a5fa !important;
    }

    html.ef-dark .progress-bar,
    html.ef-dark .timer-fill,
    html.ef-dark .ef-loading-bar {
      background: linear-gradient(90deg, #2563eb, #14b8a6) !important;
    }

    html.ef-dark .progress-track,
    html.ef-dark .timer-track,
    html.ef-dark .ef-loading-progress {
      background: #07111f !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .ef-toast {
      background: #101b2d !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 6px 6px 0 var(--shadow) !important;
    }

    html.ef-dark .ef-toast-icon,
    html.ef-dark .ef-feedback-badge,
    html.ef-dark .ef-loading-step span {
      background: #0b1525 !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    html.ef-dark .ef-toast-success .ef-toast-icon,
    html.ef-dark .ef-feedback-success,
    html.ef-dark .ef-loading-step.done span {
      background: #14532d !important;
      color: #dcfce7 !important;
      border-color: #166534 !important;
    }

    html.ef-dark .ef-toast-danger .ef-toast-icon,
    html.ef-dark .ef-feedback-danger {
      background: #7f1d1d !important;
      color: #fee2e2 !important;
      border-color: #991b1b !important;
    }

    html.ef-dark .ef-toast-info .ef-toast-icon,
    html.ef-dark .ef-feedback-info,
    html.ef-dark .ef-loading-step.active span {
      background: #1e3a8a !important;
      color: #dbeafe !important;
      border-color: #2563eb !important;
    }

    html.ef-dark .ef-loading-card::before {
      background:
        radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.24), transparent 26%),
        radial-gradient(circle at 80% 30%, rgba(20, 184, 166, 0.16), transparent 26%),
        radial-gradient(circle at 50% 80%, rgba(15, 23, 42, 0.35), transparent 26%) !important;
    }

    html.ef-dark .ef-loading-orb {
      background: linear-gradient(135deg, #1e3a8a, #0f766e) !important;
      border-color: var(--border) !important;
      box-shadow: 6px 6px 0 var(--shadow) !important;
    }

    html.ef-dark .ef-friends-tab {
      background: #0f1b2e !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 3px 3px 0 var(--shadow) !important;
    }

    html.ef-dark .ef-friends-tab.active {
      background: #1e3a8a !important;
      color: #eff6ff !important;
      border-color: #60a5fa !important;
    }

    html.ef-dark .ef-history-overlay,
    html.ef-dark .ef-feedback-overlay,
    html.ef-dark .ef-loading-overlay,
    html.ef-dark .ef-invite-overlay,
    html.ef-dark .ef-friends-overlay {
      background: rgba(2, 6, 23, 0.72) !important;
    }

    html.ef-dark .rank,
    html.ef-dark .mini-avatar,
    html.ef-dark .dash-avatar-sm {
      border-color: var(--border) !important;
      box-shadow: 3px 3px 0 var(--shadow) !important;
    }

    html.ef-dark table,
    html.ef-dark th,
    html.ef-dark td {
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    html.ef-dark .ef-answer-ok {
      background: #123524 !important;
    }

    html.ef-dark .ef-answer-partial {
      background: #3a2610 !important;
    }

    html.ef-dark .ef-answer-bad {
      background: #3b1114 !important;
    }

    .ef-theme-toggle {
      position: fixed;
      left: 22px;
      bottom: 22px;
      z-index: 80;
      border: 3px solid var(--text, #111);
      border-radius: 999px;
      background: var(--paper, #fffaf0);
      color: var(--text, #111);
      padding: 10px 14px;
      font-weight: 950;
      cursor: pointer;
      box-shadow: 4px 4px 0 var(--text, #111);
    }

    html.ef-dark .ef-theme-toggle {
      background: #101b2d !important;
      color: #e7eefc !important;
      border-color: #263955 !important;
      box-shadow: 4px 4px 0 #020617 !important;
    }

    @media (max-width: 720px) {
      .ef-theme-toggle {
        left: 14px;
        bottom: 14px;
        padding: 9px 12px;
        font-size: 0.85rem;
      }
    }
  `;

  document.head.appendChild(style);
}