import { installFeedback, showToast } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import * as api from "../shared/api.js";

let currentUser = null;
let userProfile = null;

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (auth) { currentUser = auth.user; userProfile = auth.profile; }

  prefillRoomCode();

  document.getElementById("joinArenaBtn")?.addEventListener("click", joinArena);

  // Allow pressing Enter on the nickname field to join
  document.getElementById("joinNameInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") joinArena();
  });

  // Auto-uppercase the room code input
  const codeInput = document.getElementById("joinCodeInput");
  codeInput?.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase();
  });
}

// ─── Prefill from URL ─────────────────────────────────────────────────────────

function prefillRoomCode() {
  const room = new URLSearchParams(window.location.search).get("room");
  if (!room) return;

  const codeInput  = document.getElementById("joinCodeInput");
  const statusText = document.getElementById("joinStatusText");

  if (codeInput)  codeInput.value       = room.toUpperCase();
  if (statusText) statusText.textContent = "Room code detected. Enter your nickname to join.";
}

// ─── Join arena ───────────────────────────────────────────────────────────────

async function joinArena() {
  const code     = document.getElementById("joinCodeInput").value.trim().toUpperCase();
  const name     = document.getElementById("joinNameInput").value.trim()
    || userProfile?.username
    || currentUser?.email?.split("@")[0]
    || "Guest";
  const statusEl = document.getElementById("joinStatusText");
  const joinBtn  = document.getElementById("joinArenaBtn");

  if (!code) {
    statusEl.textContent = "Enter room code.";
    showToast("Enter room code.", "info");
    return;
  }

  joinBtn.disabled     = true;
  statusEl.textContent = "Joining...";

  try {
    const { response, data } = await api.joinRoom(code, name, currentUser?.id || null);
    if (!response.ok) throw new Error(data.error || "Could not join room.");

    sessionStorage.setItem("ef_session", JSON.stringify({
      currentRoomCode:   code,
      currentPlayerId:   data.playerId,
      currentPlayerName: name,
      isHost:            false,
      localScore:        0,
      questionTime:      20,
      startedAt:         null,
      arenaEndsAt:       null,
      serverClockOffset: data.serverNow ? data.serverNow - Date.now() : 0
    }));

    nav.arena(code);
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Could not join room.";
    showToast(err.message || "Could not join room.", "danger");
  } finally {
    joinBtn.disabled = false;
  }
}

init();
