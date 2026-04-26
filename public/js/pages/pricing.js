import { installFeedback, showToast } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";

let currentUser = null;

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (auth) currentUser = auth.user;

  document.getElementById("upgradeBtn")?.addEventListener("click", startCheckout);
}

async function startCheckout() {
  if (!currentUser) {
    showToast("Trebuie sa fii autentificat pentru a face upgrade.", "info");
    setTimeout(nav.login, 1200);
    return;
  }

  const btn    = document.getElementById("upgradeBtn");
  const status = document.getElementById("upgradeStatus");

  btn.disabled    = true;
  btn.textContent = "Se proceseaza...";
  status.textContent = "";

  try {
    const res  = await fetch("/api/stripe/create-checkout-session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: currentUser.id, email: currentUser.email })
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 503) {
        status.textContent = "Stripe nu este configurat inca. Contacteaza administratorul.";
      } else {
        status.textContent = data.error || "Eroare. Incearca din nou.";
      }
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error(err);
    status.textContent = "Ceva nu a mers. Incearca din nou.";
  } finally {
    btn.disabled    = false;
    btn.textContent = "Upgrade acum";
  }
}

init();
