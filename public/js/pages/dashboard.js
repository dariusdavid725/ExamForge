import { installFeedback } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { renderDashboard, renderHistoryPage } from "../features/dashboard.js";
import { renderRoomInvitesCard } from "../components/roomInvites.js";
import * as api from "../shared/api.js";

let currentUser = null;
let userProfile = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (!auth) { nav.login(); return; }

  currentUser = auth.user;
  userProfile = auth.profile;

  document.getElementById("headerBell")?.addEventListener("click", showHistory);
  document.getElementById("backToDashboard")?.addEventListener("click", showDashboard);

  showDashboard();
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

async function showDashboard() {
  document.getElementById("historyNav")?.classList.add("hidden");
  document.getElementById("historyContent")?.classList.add("hidden");
  document.getElementById("dashboardContent")?.classList.remove("hidden");

  const container = document.getElementById("dashboardContent");
  container.innerHTML = `<div class="card"><p class="muted">Loading dashboard...</p></div>`;

  try {
    await renderDashboard(container, currentUser, userProfile, {
      onCreateArena: () => nav.create(),
      onJoinArena:   () => nav.join(),
      onHistory:     showHistory
    });

    await renderRoomInvitesCard(container, currentUser, async invite => {
      const name = userProfile?.username || currentUser?.email?.split("@")[0] || "Player";

      const { response, data } = await api.joinRoom(invite.room_code, name, currentUser.id);
      if (!response.ok) throw new Error(data.error || "Could not join room.");

      await api.respondRoomInvite(invite.id, "accepted");

      sessionStorage.setItem("ef_session", JSON.stringify({
        currentRoomCode:   invite.room_code,
        currentPlayerId:   data.playerId,
        currentPlayerName: name,
        isHost:            false,
        localScore:        0,
        questionTime:      20,
        startedAt:         null,
        arenaEndsAt:       null,
        serverClockOffset: data.serverNow ? data.serverNow - Date.now() : 0
      }));

      nav.arena(invite.room_code);
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    document.getElementById("dashboardContent").innerHTML = `<div class="card"><p class="muted">Could not load dashboard.</p></div>`;
  }
}

// ─── History view ─────────────────────────────────────────────────────────────

async function showHistory() {
  document.getElementById("dashboardContent")?.classList.add("hidden");
  document.getElementById("historyNav")?.classList.remove("hidden");
  document.getElementById("historyContent")?.classList.remove("hidden");

  const container = document.getElementById("historyContent");
  if (container) await renderHistoryPage(container, currentUser);
}

init();
