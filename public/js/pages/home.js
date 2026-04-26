import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";

async function init() {
  installThemeToggle();

  const auth = await initHeader();

  // If logged in, bell click → dashboard
  document.getElementById("headerBell")?.addEventListener("click", nav.dashboard);

  // Show login button for guests
  const loginBtn = document.getElementById("loginNavBtn");
  if (loginBtn) {
    if (auth) {
      loginBtn.style.display = "none";
    } else {
      loginBtn.style.display = "";
      loginBtn.addEventListener("click", nav.login);
    }
  }
}

init();
