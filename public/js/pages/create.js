import { installFeedback, showToast, showLoadingOverlay, updateLoadingOverlay, hideLoadingOverlay } from "../uiFeedback.js";
import { installThemeToggle } from "../theme.js";
import { initHeader, nav } from "../shared/nav.js";
import * as api from "../api.js";

let selectedGameMode = "arena_mix";
let currentUser      = null;
let userProfile      = null;

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (auth) { currentUser = auth.user; userProfile = auth.profile; }

  setupFileUpload();
  setupGameModes();

  document.getElementById("createArenaBtn")?.addEventListener("click", createArena);
}

// ─── File upload ──────────────────────────────────────────────────────────────

function setupFileUpload() {
  const dropZone   = document.getElementById("dropZone");
  const fileInput  = document.getElementById("fileInput");
  const fileNameEl = document.getElementById("fileName");
  const statusEl   = document.getElementById("hostStatusText");

  const setFile = file => {
    fileNameEl.textContent = file.name;
    if (statusEl) statusEl.textContent = "File selected.";
  };

  dropZone?.addEventListener("click",    () => fileInput.click());
  dropZone?.addEventListener("dragover", e => e.preventDefault());
  dropZone?.addEventListener("drop", e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { fileInput.files = e.dataTransfer.files; setFile(file); }
  });
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) setFile(file);
  });
}

// ─── Game modes ───────────────────────────────────────────────────────────────

function setupGameModes() {
  document.querySelectorAll(".mode-option").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedGameMode = btn.dataset.mode;
    });
  });
}

// ─── Create arena ─────────────────────────────────────────────────────────────

async function createArena() {
  const file      = document.getElementById("fileInput").files[0];
  const hostName  = document.getElementById("hostNameInput").value.trim()
    || userProfile?.username
    || currentUser?.email?.split("@")[0]
    || "Guest";
  const statusEl  = document.getElementById("hostStatusText");
  const createBtn = document.getElementById("createArenaBtn");

  if (!file) {
    statusEl.textContent = "Choose a document first.";
    showToast("Choose a document first.", "info");
    return;
  }

  showLoadingOverlay({
    title: "Forging your arena...",
    message: "Reading your document.",
    steps: ["Reading document", "Extracting concepts", "Generating challenges", "Checking quality", "Opening lobby"]
  });

  createBtn.disabled   = true;
  statusEl.textContent = "Starting...";

  try {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("gameMode", selectedGameMode);

    const packData = await api.generatePack(formData, msg => {
      statusEl.textContent = msg;
      updateLoadingOverlay(msg);
    });

    updateLoadingOverlay("Opening lobby...", 92);
    statusEl.textContent = "Creating arena...";

    const { response: roomRes, data: roomData } = await api.createRoom(packData.pack);
    if (!roomRes.ok) throw new Error(roomData.error || "Could not create room.");

    const roomCode = roomData.code;

    const { response: joinRes, data: joinData } = await api.joinRoom(roomCode, hostName, currentUser?.id || null);
    if (!joinRes.ok) throw new Error(joinData.error || "Could not join room.");

    sessionStorage.setItem("ef_session", JSON.stringify({
      currentRoomCode:   roomCode,
      currentPlayerId:   joinData.playerId,
      currentPlayerName: hostName,
      isHost:            true,
      localScore:        0,
      questionTime:      20,
      startedAt:         null,
      arenaEndsAt:       null,
      serverClockOffset: joinData.serverNow ? joinData.serverNow - Date.now() : 0,
      documentName:      file.name,
      documentText:      packData.documentText || ""
    }));

    nav.arena(roomCode);
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Something went wrong.";
    showToast(err.message || "Something went wrong.", "danger");
  } finally {
    hideLoadingOverlay();
    createBtn.disabled = false;
  }
}

init();
