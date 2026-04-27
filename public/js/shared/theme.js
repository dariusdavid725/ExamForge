let themeInstalled = false;

export function installThemeToggle() {
  if (themeInstalled) return;
  themeInstalled = true;

  injectThemeStyles();

  const saved = localStorage.getItem("ef_theme") || "light";
  applyTheme(saved);

  if (document.getElementById("efThemeToggle")) return;

  const btn = document.createElement("button");
  btn.id = "efThemeToggle";
  btn.type = "button";
  btn.className = "ef-theme-toggle";
  btn.setAttribute("aria-label", "Toggle dark mode");
  document.body.appendChild(btn);

  updateToggleLabel(btn);

  btn.addEventListener("click", () => {
    const next = document.documentElement.classList.contains("ef-dark") ? "light" : "dark";
    applyTheme(next);
    updateToggleLabel(btn);
  });
}

export function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("ef-dark", dark);
  localStorage.setItem("ef_theme", dark ? "dark" : "light");
}

// keep old name for compatibility
export const setTheme = applyTheme;

function updateToggleLabel(btn) {
  const dark = document.documentElement.classList.contains("ef-dark");
  btn.innerHTML = dark ? "☀️" : "🌙";
  btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
}

function injectThemeStyles() {
  if (document.getElementById("ef-theme-styles")) return;

  const style = document.createElement("style");
  style.id = "ef-theme-styles";

  style.textContent = `
    /* ── Dark mode palette ───────────────────────────────────────────────────
       Warm brown-gray tones that complement the light mode's beige identity.
       No cold blue-black — the app stays warm even at night.
    ─────────────────────────────────────────────────────────────────────── */

    html.ef-dark {
      color-scheme: dark;

      --bg:       #1c1917;   /* warm almost-black */
      --paper:    #28231f;   /* card surface */
      --paper-2:  #332e29;   /* slightly raised */
      --text:     #f5f0e8;   /* warm off-white */
      --muted:    #a89e8e;   /* warm mid-gray */
      --line:     #f5f0e8;
      --border:   #4a4339;   /* warm dark border */
      --shadow:   #0d0b09;   /* deep warm shadow */

      /* keep accent colors — they work well on dark */
      --blue:     #6366f1;
      --green:    #00d084;
      --yellow:   #ffd23f;
      --red:      #ff6b6b;
      --purple:   #c084fc;
      --orange:   #fb923c;
    }

    /* ── Body & background ──────────────────────────────────────────────── */

    html.ef-dark body {
      background:
        radial-gradient(rgba(245, 240, 232, 0.055) 1px, transparent 1px),
        var(--bg) !important;
      background-size: 26px 26px !important;
      color: var(--text) !important;
    }

    /* ── Header ─────────────────────────────────────────────────────────── */

    html.ef-dark header {
      background: var(--paper) !important;
      border-bottom-color: var(--border) !important;
    }

    html.ef-dark .nav-note {
      background: var(--green) !important;
      border-color: var(--border) !important;
      color: #0d0b09 !important;
    }

    /* ── Cards ───────────────────────────────────────────────────────────── */

    html.ef-dark .card,
    html.ef-dark .flat-card,
    html.ef-dark .player-card,
    html.ef-dark .leader-row {
      background: var(--paper) !important;
      border-color: var(--border) !important;
      box-shadow: 8px 8px 0 var(--shadow) !important;
      color: var(--text) !important;
    }

    html.ef-dark .card:hover,
    html.ef-dark .flat-card:hover {
      box-shadow: 10px 10px 0 var(--shadow) !important;
    }

    html.ef-dark .leader-row.first {
      background: #3a3015 !important;
      border-color: var(--border) !important;
    }

    /* ── Text ────────────────────────────────────────────────────────────── */

    html.ef-dark h1,
    html.ef-dark h2,
    html.ef-dark h3,
    html.ef-dark p,
    html.ef-dark strong,
    html.ef-dark label,
    html.ef-dark span,
    html.ef-dark li {
      color: var(--text) !important;
    }

    html.ef-dark .muted,
    html.ef-dark .dash-stat-label {
      color: var(--muted) !important;
    }

    html.ef-dark .lead {
      background: rgba(40, 35, 31, 0.85) !important;
      border-left-color: var(--border) !important;
    }

    /* ── Eyebrow ─────────────────────────────────────────────────────────── */

    html.ef-dark .eyebrow {
      background: #3730a3 !important;
      border-color: var(--border) !important;
      color: #e0e7ff !important;
    }

    /* ── Inputs ──────────────────────────────────────────────────────────── */

    html.ef-dark .input {
      background: #1a1511 !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .input::placeholder {
      color: #7a6e62 !important;
    }

    html.ef-dark .input:focus {
      background: #211c18 !important;
      box-shadow: 6px 6px 0 #3730a3 !important;
    }

    /* ── Buttons ─────────────────────────────────────────────────────────── */

    html.ef-dark .btn {
      background: var(--blue) !important;
      border-color: var(--border) !important;
      box-shadow: 5px 5px 0 var(--shadow) !important;
      color: #f0eef9 !important;
    }

    html.ef-dark .btn:hover {
      box-shadow: 7px 7px 0 var(--shadow) !important;
    }

    html.ef-dark .btn:active {
      box-shadow: 1px 1px 0 var(--shadow) !important;
    }

    html.ef-dark .btn:disabled {
      opacity: 0.45 !important;
      box-shadow: 5px 5px 0 var(--shadow) !important;
    }

    html.ef-dark .btn-secondary {
      background: var(--paper-2) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    /* ── Upload box ──────────────────────────────────────────────────────── */

    html.ef-dark .upload-box {
      background: #221d18 !important;
      border-color: var(--border) !important;
    }

    html.ef-dark .upload-box:hover {
      background: #2c2520 !important;
    }

    /* ── Game mode options ───────────────────────────────────────────────── */

    html.ef-dark .mode-option {
      background: var(--paper-2) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .mode-option span {
      color: var(--muted) !important;
    }

    html.ef-dark .mode-option.selected {
      background: #0d4a36 !important;
      border-color: var(--green) !important;
    }

    html.ef-dark .mode-option.selected span {
      color: #a7f3d0 !important;
    }

    /* ── Challenge chips ─────────────────────────────────────────────────── */

    html.ef-dark .challenge-chip {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .challenge-chip:nth-child(2) { background: #3a3015 !important; }
    html.ef-dark .challenge-chip:nth-child(3) { background: #0d3d28 !important; }
    html.ef-dark .challenge-chip:nth-child(4) { background: #2d1f46 !important; }
    html.ef-dark .challenge-chip:nth-child(5) { background: #3a2010 !important; }

    /* ── Pills ───────────────────────────────────────────────────────────── */

    html.ef-dark .pill {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      color: var(--text) !important;
      box-shadow: 3px 3px 0 var(--shadow) !important;
    }

    html.ef-dark .pill:nth-child(2n) { background: #3a3015 !important; }
    html.ef-dark .pill:nth-child(3n) { background: #0d3d28 !important; }

    /* ── Room code ───────────────────────────────────────────────────────── */

    html.ef-dark .room-code {
      background: #0d3d28 !important;
      border-color: var(--border) !important;
      box-shadow: 10px 10px 0 var(--shadow) !important;
      color: var(--text) !important;
    }

    /* ── Progress ────────────────────────────────────────────────────────── */

    html.ef-dark .progress-track {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
    }

    html.ef-dark .progress-fill {
      background: var(--green) !important;
      border-right-color: var(--border) !important;
    }

    /* ── Timer ring ──────────────────────────────────────────────────────── */

    html.ef-dark .timer {
      background:
        radial-gradient(circle at center, var(--paper) 55%, transparent 56%),
        conic-gradient(var(--green) var(--timer), #3a3428 0) !important;
      border-color: var(--border) !important;
      box-shadow: 5px 5px 0 var(--shadow) !important;
    }

    /* ── Answer options ──────────────────────────────────────────────────── */

    html.ef-dark .option,
    html.ef-dark .step-option,
    html.ef-dark .chosen-step {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      color: var(--text) !important;
      box-shadow: 5px 5px 0 var(--shadow) !important;
    }

    html.ef-dark .option:hover,
    html.ef-dark .step-option:hover {
      background: #3d3830 !important;
      box-shadow: 7px 7px 0 var(--shadow) !important;
    }

    html.ef-dark .option.selected {
      background: var(--blue) !important;
      border-color: #818cf8 !important;
      color: #e0e7ff !important;
    }

    html.ef-dark .option.correct {
      background: #0d4a36 !important;
      border-color: var(--green) !important;
      color: #a7f3d0 !important;
    }

    html.ef-dark .option.wrong {
      background: #4a1515 !important;
      border-color: var(--red) !important;
      color: #fca5a5 !important;
    }

    html.ef-dark .chosen-step { background: #0d4a36 !important; }

    /* ── Auth screen ─────────────────────────────────────────────────────── */

    html.ef-dark .auth-tab {
      background: var(--paper-2) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    html.ef-dark .auth-tab-active {
      background: var(--blue) !important;
      color: #e0e7ff !important;
    }

    /* ── Dashboard ───────────────────────────────────────────────────────── */

    html.ef-dark .dash-stat {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      box-shadow: 3px 3px 0 var(--shadow) !important;
    }

    html.ef-dark .dash-session-row {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      box-shadow: 3px 3px 0 var(--shadow) !important;
    }

    html.ef-dark .dash-session-row:hover {
      background: #3d3830 !important;
      box-shadow: 5px 5px 0 var(--shadow) !important;
    }

    /* ── Matching ────────────────────────────────────────────────────────── */

    html.ef-dark .matched-row {
      background: #0d4a36 !important;
      border-color: var(--border) !important;
    }

    /* ── Mini leaderboard ────────────────────────────────────────────────── */

    html.ef-dark .mini-lb-row {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    html.ef-dark .mini-lb-row.mini-lb-first {
      background: #3a3015 !important;
      border-color: var(--yellow) !important;
    }

    html.ef-dark .mini-lb-rank {
      background: var(--blue) !important;
    }

    /* ── Result phase cards ──────────────────────────────────────────────── */

    html.ef-dark .result-correct {
      background: #0d4a36 !important;
      border-color: var(--green) !important;
      color: #a7f3d0 !important;
    }

    html.ef-dark .result-correct h2,
    html.ef-dark .result-correct p { color: #a7f3d0 !important; }

    html.ef-dark .result-wrong {
      background: #4a1515 !important;
      border-color: var(--red) !important;
      color: #fca5a5 !important;
    }

    html.ef-dark .result-wrong h2,
    html.ef-dark .result-wrong p { color: #fca5a5 !important; }

    html.ef-dark .result-partial {
      background: #3a2010 !important;
      border-color: var(--orange) !important;
      color: #fed7aa !important;
    }

    /* ── Waiting badge ────────────────────────────────────────────────────── */

    html.ef-dark .waiting-badge {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }

    /* ── Podium ──────────────────────────────────────────────────────────── */

    html.ef-dark .podium-place.second .podium-block,
    html.ef-dark .podium-place.third  .podium-block {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
    }

    html.ef-dark .podium-place.first .podium-block {
      background: #3a3015 !important;
      border-color: var(--yellow) !important;
    }

    html.ef-dark .podium-place.second .podium-avatar { background: #3d3830 !important; }
    html.ef-dark .podium-place.third  .podium-avatar { background: #3a2c1a !important; }

    /* ── Code blocks ─────────────────────────────────────────────────────── */

    html.ef-dark .code-block {
      background: #0d0b09 !important;
      border-color: var(--border) !important;
      color: #d6cfba !important;
    }

    html.ef-dark .inline-code {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      color: #f0a070 !important;
    }

    html.ef-dark .math-inline {
      background: #2d1f46 !important;
      border-color: var(--purple) !important;
      color: var(--purple) !important;
    }

    /* ── Toasts & modals (uiFeedback.js) ────────────────────────────────── */

    html.ef-dark .ef-toast {
      background: var(--paper) !important;
      border-color: var(--border) !important;
      color: var(--text) !important;
      box-shadow: 6px 6px 0 var(--shadow) !important;
    }

    html.ef-dark .ef-feedback-modal,
    html.ef-dark .ef-loading-card,
    html.ef-dark .ef-invite-modal,
    html.ef-dark .ef-friends-modal,
    html.ef-dark .ef-history-modal {
      background: var(--paper) !important;
      border-color: var(--border) !important;
      box-shadow: 8px 8px 0 var(--shadow) !important;
      color: var(--text) !important;
    }

    html.ef-dark .ef-history-overlay,
    html.ef-dark .ef-feedback-overlay,
    html.ef-dark .ef-loading-overlay,
    html.ef-dark .ef-invite-overlay,
    html.ef-dark .ef-friends-overlay,
    html.ef-dark .session-modal-overlay {
      background: rgba(12, 10, 8, 0.75) !important;
    }

    html.ef-dark .session-modal {
      background: var(--paper) !important;
      border-color: var(--border) !important;
    }

    /* ── Rank badge ──────────────────────────────────────────────────────── */

    html.ef-dark .rank {
      background: var(--blue) !important;
      border-color: var(--border) !important;
      box-shadow: 3px 3px 0 var(--shadow) !important;
      color: #e0e7ff !important;
    }

    /* ── Footer ──────────────────────────────────────────────────────────── */

    html.ef-dark .site-footer {
      background: var(--paper) !important;
      border-top-color: var(--border) !important;
    }

    html.ef-dark .footer-row span {
      color: var(--muted) !important;
    }

    /* ── Theme toggle button ─────────────────────────────────────────────── */

    .ef-theme-toggle {
      position: fixed;
      left: 20px;
      bottom: 80px;
      z-index: 150;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 3px solid #111;
      background: #fffaf0;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 4px 4px 0 #111;
      display: grid;
      place-items: center;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .ef-theme-toggle:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #111;
    }

    .ef-theme-toggle:active {
      transform: translate(2px, 2px);
      box-shadow: 1px 1px 0 #111;
    }

    html.ef-dark .ef-theme-toggle {
      background: var(--paper-2) !important;
      border-color: var(--border) !important;
      box-shadow: 4px 4px 0 var(--shadow) !important;
    }
  `;

  document.head.appendChild(style);
}
