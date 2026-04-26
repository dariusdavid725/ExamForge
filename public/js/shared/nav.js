import { getSession } from "../auth.js";
import { getProfile, getSupabase } from "../supabaseClient.js";

// ─── Navigation helpers ───────────────────────────────────────────────────────

export const nav = {
  home:      ()     => { window.location.href = "/"; },
  create:    ()     => { window.location.href = "/create"; },
  join:      (code) => { window.location.href = code ? `/join?room=${code}` : "/join"; },
  login:     ()     => { window.location.href = "/login"; },
  dashboard: ()     => { window.location.href = "/dashboard"; },
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

  const area = document.getElementById("headerUserArea");

  if (area) {
    area.innerHTML = `
      <div style="width:34px;height:34px;border-radius:999px;background:${color};color:white;
                  display:grid;place-items:center;font-weight:900;border:3px solid var(--text);">${letter}</div>
      <strong>${profile?.username || ""}</strong>`;
    area.style.display = "flex";
    area.onclick = nav.dashboard;
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
