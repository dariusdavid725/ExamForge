import { getSession } from "../shared/auth.js";
import { installFeedback, showToast } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";

const el = id => document.getElementById(id);

async function authHeaders() {
  const session = await getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Missing session.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function setGuardMessage(message) {
  const guard = el("adminGuardCard");
  if (guard) guard.innerHTML = `<p class="muted">${message}</p>`;
}

async function loadOverview() {
  const headers = await authHeaders();
  const data = await fetchJson("/api/admin/overview", { headers });
  el("adminOverviewCard").innerHTML = `
    <div class="eyebrow">Overview</div>
    <h3 style="margin:10px 0 14px;">Admin metrics</h3>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:10px;">
      <div class="flat-card"><strong>Total users</strong><div style="font-size:24px;margin-top:6px;">${data.usersCount || 0}</div></div>
      <div class="flat-card"><strong>Premium users</strong><div style="font-size:24px;margin-top:6px;">${data.premiumCount || 0}</div></div>
      <div class="flat-card"><strong>Events 7d</strong><div style="font-size:24px;margin-top:6px;">${data.events7d || 0}</div></div>
    </div>
  `;
}

async function loadAdmins() {
  const headers = await authHeaders();
  const data = await fetchJson("/api/admin/admins", { headers });
  const admins = data.admins || [];
  const container = el("adminList");
  if (!container) return;

  if (!admins.length) {
    container.innerHTML = `<p class="muted">No admins found.</p>`;
    return;
  }

  container.innerHTML = admins.map(admin => `
    <div class="dash-session-row" style="cursor:default;">
      <div style="min-width:0;">
        <strong>${escapeHTML(admin.username || "User")}</strong>
        <p class="muted" style="font-size:12px;margin-top:2px;">${escapeHTML(admin.email || "No email")}</p>
      </div>
      <button class="btn btn-secondary" data-revoke-admin="${admin.email || ""}" type="button" style="padding:6px 10px;font-size:12px;">Revoke</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-revoke-admin]").forEach(button => {
    button.addEventListener("click", async () => {
      const email = button.dataset.revokeAdmin;
      if (!email) return;

      const confirmed = confirm(`Are you sure you want to revoke admin access for ${email}?`);
      if (!confirmed) return;

      try {
        const headersForPost = await authHeaders();
        await fetchJson("/api/admin/admins", {
          method: "POST",
          headers: headersForPost,
          body: JSON.stringify({ email, isAdmin: false })
        });
        showToast("Admin revoked.", "success");
        await Promise.all([loadAdmins(), loadAuditLogs()]);
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  });
}

async function loadRecentEvents() {
  const headers = await authHeaders();
  const data = await fetchJson("/api/admin/events/recent", { headers });
  const events = data.events || [];
  const container = el("recentEventsList");
  if (!container) return;

  if (!events.length) {
    container.innerHTML = `<p class="muted">No events yet.</p>`;
    return;
  }

  container.innerHTML = events.map(event => `
    <div class="flat-card">
      <strong>${escapeHTML(event.name)}</strong>
      <p class="muted" style="margin-top:4px;font-size:12px;">
        ${escapeHTML(event.source || "web")} · ${new Date(event.created_at).toLocaleString()}
      </p>
    </div>
  `).join("");
}

async function loadAuditLogs() {
  const headers = await authHeaders();
  const data = await fetchJson("/api/admin/audit-logs", { headers });
  const logs = data.logs || [];
  const container = el("auditLogsList");
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = `<p class="muted">No admin actions yet.</p>`;
    return;
  }

  container.innerHTML = logs.map(log => {
    const actionLabel = log.action === "admin_granted" ? "🔓 Granted admin" : "🔒 Revoked admin";
    return `
      <div class="flat-card">
        <strong>${actionLabel}</strong>
        <p class="muted" style="margin-top:4px;font-size:12px;">
          <strong>Target:</strong> ${escapeHTML(log.target_email)} · 
          <strong>By:</strong> ${escapeHTML(log.actor_email || "Unknown")} · 
          ${new Date(log.created_at).toLocaleString()}
        </p>
      </div>
    `;
  }).join("");
}

async function grantAdmin() {
  const input = el("adminEmailInput");
  const status = el("adminActionStatus");
  const email = String(input?.value || "").trim().toLowerCase();
  if (!email) {
    showToast("Enter an email first.", "info");
    return;
  }

  const confirmed = confirm(`Grant admin access to ${email}?`);
  if (!confirmed) return;

  try {
    const headers = await authHeaders();
    await fetchJson("/api/admin/admins", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, isAdmin: true })
    });
    if (status) status.textContent = `Admin granted to ${email}.`;
    showToast("Admin granted.", "success");
    input.value = "";
    await Promise.all([loadAdmins(), loadAuditLogs()]);
  } catch (error) {
    if (status) status.textContent = error.message;
    showToast(error.message, "danger");
  }
}

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (!auth) { nav.login(); return; }

  document.getElementById("brandLogo")?.addEventListener("click", nav.dashboard);

  const isBootstrapAdmin = String(auth.user?.email || "").toLowerCase() === "dariusdavid26@yahoo.com";
  if (!auth.profile?.is_admin && !isBootstrapAdmin) {
    setGuardMessage("Admin access required.");
    return;
  }

  el("adminGuardCard")?.classList.add("hidden");
  el("adminContent")?.classList.remove("hidden");

  el("grantAdminBtn")?.addEventListener("click", grantAdmin);

  try {
    await Promise.all([loadOverview(), loadAdmins(), loadRecentEvents(), loadAuditLogs()]);
  } catch (error) {
    setGuardMessage(error.message || "Could not load admin panel.");
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();
