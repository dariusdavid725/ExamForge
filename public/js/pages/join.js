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

  const codeInput = document.getElementById("joinCodeInput");
  if (codeInput) codeInput.value = room.toUpperCase();
}

function showError(message) {
  const statusEl = document.getElementById("joinStatusText");
  if (!statusEl) return;
  statusEl.className = "form-error mt-4";
  statusEl.textContent = message;
  statusEl.style.display = "flex";
}

function clearError() {
  const statusEl = document.getElementById("joinStatusText");
  if (!statusEl) return;
  statusEl.style.display = "none";
  statusEl.textContent = "";
}

// ─── Join arena ───────────────────────────────────────────────────────────────

async function joinArena() {
  const code = document.getElementById("joinCodeInput").value.trim().toUpperCase();
  const name = document.getElementById("joinNameInput").value.trim()
    || userProfile?.username
    || currentUser?.email?.split("@")[0]
    || "Guest";
  const joinBtn = document.getElementById("joinArenaBtn");

  if (!code) {
    showError("Please enter a room code.");
    showToast("Enter room code.", "info");
    return;
  }

  clearError();
  joinBtn.classList.add("btn-loading");
  joinBtn.disabled = true;

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

    showToast("Joined successfully!", "success");
    nav.arena(code);
  } catch (err) {
    console.error(err);
    showError(err.message || "Failed to join room. Please check the code and try again.");
    showToast(err.message || "Could not join room.", "danger");
  } finally {
    joinBtn.classList.remove("btn-loading");
    joinBtn.disabled = false;
  }
}

init();
