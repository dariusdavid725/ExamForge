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
    showToast("You need to be logged in to upgrade.", "info");
    setTimeout(nav.login, 1200);
    return;
  }

  const btn = document.getElementById("upgradeBtn");
  const status = document.getElementById("upgradeStatus");

  btn.classList.add("btn-loading");
  btn.disabled = true;
  if (status) status.textContent = "";

  try {
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, email: currentUser.email })
    });
    const data = await res.json();

    if (!res.ok) {
      const errorMsg = res.status === 503
        ? "Stripe is not configured yet. Please contact the administrator."
        : (data.error || "Something went wrong. Please try again.");
      
      if (status) status.textContent = errorMsg;
      showToast(errorMsg, "danger");
      return;
    }

    if (data.url) {
      showToast("Redirecting to checkout...", "success");
      window.location.href = data.url;
    }
  } catch (err) {
    console.error(err);
    const errorMsg = "Something went wrong. Please try again.";
    if (status) status.textContent = errorMsg;
    showToast(errorMsg, "danger");
  } finally {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

init();
