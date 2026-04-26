import { getSession, login, register } from "../auth.js";
import { installFeedback, showToast } from "../uiFeedback.js";
import { installThemeToggle } from "../theme.js";
import { nav } from "../shared/nav.js";

async function init() {
  installFeedback();
  installThemeToggle();

  document.getElementById("brandLogo")?.addEventListener("click", nav.home);

  // Already logged in → go straight to dashboard
  const session = await getSession().catch(() => null);
  if (session) { nav.dashboard(); return; }

  setupTabs();
  setupForms();
}

function setupTabs() {
  const loginTab    = document.getElementById("authTabLogin");
  const registerTab = document.getElementById("authTabRegister");
  const loginForm   = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  loginTab?.addEventListener("click", () => {
    loginTab.classList.add("auth-tab-active");
    registerTab?.classList.remove("auth-tab-active");
    loginForm?.classList.remove("hidden");
    registerForm?.classList.add("hidden");
    document.getElementById("loginError").textContent = "";
  });

  registerTab?.addEventListener("click", () => {
    registerTab.classList.add("auth-tab-active");
    loginTab?.classList.remove("auth-tab-active");
    registerForm?.classList.remove("hidden");
    loginForm?.classList.add("hidden");
    document.getElementById("registerError").textContent = "";
  });
}

function setupForms() {
  document.getElementById("loginBtn")?.addEventListener("click", handleLogin);
  document.getElementById("loginPassword")?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
  document.getElementById("registerBtn")?.addEventListener("click", handleRegister);
  document.getElementById("registerPassword")?.addEventListener("keydown", e => { if (e.key === "Enter") handleRegister(); });
}

async function handleLogin() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl  = document.getElementById("loginError");
  const btn      = document.getElementById("loginBtn");

  if (!email || !password) { errorEl.textContent = "Enter your email and password."; return; }

  errorEl.textContent = "";
  btn.textContent = "Logging in...";
  btn.disabled    = true;

  try {
    await login(email, password);
    showToast("Logged in.", "success");
    nav.dashboard();
  } catch (err) {
    errorEl.textContent = err.message || "Login failed.";
    showToast(err.message || "Login failed.", "danger");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Login";
  }
}

async function handleRegister() {
  const username = document.getElementById("registerUsername").value.trim();
  const email    = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const errorEl  = document.getElementById("registerError");
  const btn      = document.getElementById("registerBtn");

  if (!username || !email || !password) { errorEl.textContent = "All fields are required."; return; }

  errorEl.textContent = "";
  btn.textContent = "Creating account...";
  btn.disabled    = true;

  try {
    await register(email, password, username);
    showToast("Account created successfully.", "success");
    nav.dashboard();
  } catch (err) {
    errorEl.textContent = err.message || "Registration failed.";
    showToast(err.message || "Registration failed.", "danger");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Create account";
  }
}

init();
