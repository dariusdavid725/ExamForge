import { getSession } from "./auth.js";
import { getProfile, getSupabase } from "./supabaseClient.js";

// ─── Navigation helpers ───────────────────────────────────────────────────────

export const nav = {
  home:      ()     => { window.location.href = "/"; },
  create:    ()     => { window.location.href = "/create"; },
  join:      (code) => { window.location.href = code ? `/join?room=${code}` : "/join"; },
  login:     ()     => { window.location.href = "/login"; },
  dashboard: ()     => { window.location.href = "/dashboard"; },
  lessons:   ()     => { window.location.href = "/lessons"; },
  pricing:   ()     => { window.location.href = "/pricing"; },
  arena:     code   => { window.location.href = `/arena?room=${code}`; }
};

// ─── Header setup ─────────────────────────────────────────────────────────────

export async function initHeader({ onAvatarClick } = {}) {
  document.getElementById("brandLogo")?.addEventListener("click", nav.home);

  try {
    const session = await getSession();

    if (!session) {
      _renderGuestHeader(onAvatarClick || nav.login);
      return null;
    }

    const profile = await getProfile(session.user.id);
    await _renderUserHeader(session.user, profile);
    return { user: session.user, profile };
  } catch {
    _renderGuestHeader(onAvatarClick || nav.login);
    return null;
  }
}

function _renderGuestHeader(onClickFn) {
  const area = document.getElementById("headerUserArea");

  if (area) {
    area.innerHTML = `
      <div style="width:34px;height:34px;border-radius:999px;background:#111;color:white;
                  display:grid;place-items:center;font-weight:900;border:3px solid var(--text);">G</div>
      <strong>Guest</strong>`;
    area.style.display = "flex";
    area.onclick = onClickFn;
  }

  const streak = document.getElementById("headerStreak");
  if (streak) streak.style.display = "none";

  const bell = document.getElementById("headerBell");
  if (bell) bell.style.display = "none";
}

async function _renderUserHeader(user, profile) {
  const letter = (profile?.username || user.email || "U")[0].toUpperCase();
  const color  = profile?.avatar_color || "#4f46e5";
  const streak = profile?.streak_count || 0;
  const plan   = profile?.plan || "free";

  const area = document.getElementById("headerUserArea");

  if (area) {
    area.style.position = "relative";
    area.style.display  = "flex";
    area.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" id="avatarTrigger">
        <div style="width:34px;height:34px;border-radius:999px;background:${color};color:white;
                    display:grid;place-items:center;font-weight:900;border:3px solid var(--text);">${letter}</div>
        <strong>${profile?.username || ""}</strong>
        ${plan === "premium" ? `<span style="background:var(--blue);color:white;font-size:10px;font-weight:900;
          padding:2px 7px;border-radius:999px;border:2px solid var(--text);">PRO</span>` : ""}
        <span style="font-size:10px;color:var(--muted);">▼</span>
      </div>

      <div id="avatarDropdown" style="
        display:none;position:absolute;top:calc(100% + 10px);right:0;
        background:var(--paper);border:3px solid var(--text);box-shadow:4px 4px 0 var(--text);
        min-width:180px;z-index:999;border-radius:6px;overflow:hidden;">
        <a href="/dashboard" style="display:block;padding:12px 16px;font-weight:700;
           text-decoration:none;color:var(--text);border-bottom:2px solid var(--text);">
          Dashboard
        </a>
        <a href="/pricing" style="display:block;padding:12px 16px;font-weight:700;
           text-decoration:none;color:var(--text);border-bottom:2px solid var(--text);">
          ${plan === "premium" ? "Gestioneaza abonamentul" : "Abonament ⭐"}
        </a>
        <button id="dropdownLogout" style="
          display:block;width:100%;text-align:left;padding:12px 16px;font-weight:700;
          background:none;border:none;cursor:pointer;font-family:inherit;font-size:inherit;
          color:var(--red);">
          Logout
        </button>
      </div>`;

    const trigger  = area.querySelector("#avatarTrigger");
    const dropdown = area.querySelector("#avatarDropdown");

    trigger.addEventListener("click", e => {
      e.stopPropagation();
      const open = dropdown.style.display === "block";
      dropdown.style.display = open ? "none" : "block";
    });

    document.addEventListener("click", () => { dropdown.style.display = "none"; });

    area.querySelector("#dropdownLogout")?.addEventListener("click", async e => {
      e.stopPropagation();
      const { logout } = await import("./auth.js");
      await logout();
      location.href = "/";
    });
  }

  const streakEl = document.getElementById("headerStreak");
  if (streakEl) {
    streakEl.textContent = `${streak}`;
    streakEl.style.display = streak > 0 ? "" : "none";
  }

  // Notification badge
  try {
    const sb    = await getSupabase();
    const { data } = await sb.from("friendships").select("id").eq("addressee_id", user.id).eq("status", "pending");
    const count = (data || []).length;
    const badge = document.getElementById("bellBadge");
    const bell  = document.getElementById("headerBell");

    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? "" : "none"; }
    if (bell)  { bell.style.display = count > 0 ? "" : "none"; }
  } catch {}
}
