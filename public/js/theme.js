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

      --bg: #111827;
      --paper: #1f2937;
      --surface: #182033;
      --text: #f8fafc;
      --muted: #cbd5e1;
      --accent: #a78bfa;
      --accent-2: #38bdf8;
      --success: #86efac;
      --danger: #fca5a5;
      --warning: #fde68a;
    }

    html.ef-dark body {
      background:
        radial-gradient(circle at top left, rgba(167, 139, 250, 0.18), transparent 34%),
        radial-gradient(circle at bottom right, rgba(56, 189, 248, 0.14), transparent 30%),
        #111827 !important;
      color: var(--text) !important;
    }

    html.ef-dark .card,
    html.ef-dark .flat-card,
    html.ef-dark .dash-session-row,
    html.ef-dark .dash-stat,
    html.ef-dark .auth-card,
    html.ef-dark .challenge-card,
    html.ef-dark .lobby-card,
    html.ef-dark .leaderboard-card {
      background: var(--paper) !important;
      color: var(--text) !important;
      border-color: var(--text) !important;
      box-shadow: 6px 6px 0 rgba(248, 250, 252, 0.9) !important;
    }

    html.ef-dark .muted,
    html.ef-dark .dash-stat-label {
      color: var(--muted) !important;
    }

    html.ef-dark input,
    html.ef-dark textarea,
    html.ef-dark select {
      background: #0f172a !important;
      color: var(--text) !important;
      border-color: var(--text) !important;
    }

    html.ef-dark .btn {
      background: var(--accent) !important;
      color: #111827 !important;
      border-color: var(--text) !important;
      box-shadow: 4px 4px 0 rgba(248, 250, 252, 0.95) !important;
    }

    html.ef-dark .btn.btn-secondary {
      background: #0f172a !important;
      color: var(--text) !important;
    }

    html.ef-dark .progress-bar,
    html.ef-dark .timer-fill {
      background: linear-gradient(90deg, var(--accent), var(--accent-2)) !important;
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
      background: #0f172a;
      color: #f8fafc;
      box-shadow: 4px 4px 0 #f8fafc;
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