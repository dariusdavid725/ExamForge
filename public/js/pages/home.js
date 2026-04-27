import { installFeedback, showToast } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";

function trackEvent(name, meta = {}) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, source: "home", meta })
  }).catch(() => {});
}

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();

  document.getElementById("headerBell")?.addEventListener("click", nav.dashboard);

  // Login button (only shown to guests)
  const loginBtn = document.getElementById("loginNavBtn");
  if (loginBtn) {
    if (auth) {
      loginBtn.style.display = "none";
    } else {
      loginBtn.style.display = "";
      loginBtn.addEventListener("click", nav.login);
    }
  }

  // "Create Arena" is restricted to logged-in users
  const createLink = document.getElementById("createArenaLink");
  if (createLink && !auth) {
    createLink.addEventListener("click", e => {
      e.preventDefault();
      showToast("Sign in to create an arena.", "info");
      setTimeout(nav.login, 1200);
    });
  }

  const demoLink = document.getElementById("tryDemoLink");
  demoLink?.addEventListener("click", () => {
    trackEvent("activation_demo_start_clicked", { authenticated: Boolean(auth) });
  });
}

init();
