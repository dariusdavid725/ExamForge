import { getSession, login, register } from "../shared/auth.js";
import { installFeedback, showToast } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
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
    clearError("loginError");
  });

  registerTab?.addEventListener("click", () => {
    registerTab.classList.add("auth-tab-active");
    loginTab?.classList.remove("auth-tab-active");
    registerForm?.classList.remove("hidden");
    loginForm?.classList.add("hidden");
    clearError("registerError");
  });
}

function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (!errorEl) return;
  errorEl.className = "form-error mt-4";
  errorEl.textContent = message;
  errorEl.style.display = "flex";
}

function clearError(elementId) {
  const errorEl = document.getElementById(elementId);
  if (!errorEl) return;
  errorEl.style.display = "none";
  errorEl.textContent = "";
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
  const btn      = document.getElementById("loginBtn");

  if (!email || !password) { 
    showError("loginError", "Please enter your email and password.");
    return;
  }

  clearError("loginError");
  btn.classList.add("btn-loading");
  btn.textContent = "Logging in...";
  btn.disabled    = true;

  try {
    await login(email, password);
    showToast("Logged in successfully!", "success");
    nav.dashboard();
  } catch (err) {
    showError("loginError", err.message || "Login failed. Please check your credentials.");
    showToast(err.message || "Login failed.", "danger");
  } finally {
    btn.disabled    = false;
    btn.classList.remove("btn-loading");
    btn.textContent = "Login";
  }
}

async function handleRegister() {
  const username = document.getElementById("registerUsername").value.trim();
  const email    = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const btn      = document.getElementById("registerBtn");

  if (!username || !email || !password) { 
    showError("registerError", "All fields are required.");
    return;
  }
  
  if (password.length < 6) {
    showError("registerError", "Password must be at least 6 characters long.");
    return;
  }

  clearError("registerError");
  btn.classList.add("btn-loading");
  btn.textContent = "Creating account...";
  btn.disabled    = true;

  try {
    await register(email, password, username);
    showToast("Account created successfully!", "success");
    nav.dashboard();
  } catch (err) {
    showError("registerError", err.message || "Registration failed. Please try again.");
    showToast(err.message || "Registration failed.", "danger");
  } finally {
    btn.disabled    = false;
    btn.classList.remove("btn-loading");
    btn.textContent = "Create Account";
  }
}

init();
