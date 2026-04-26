import { installFeedback, showToast, showLoadingOverlay, updateLoadingOverlay, hideLoadingOverlay } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { getLessonsFromStorage } from "../shared/lessonStorage.js";
import * as api from "../shared/api.js";

let selectedGameMode = "arena_mix";
let currentUser      = null;
let userProfile      = null;
let activeSource     = "upload";   // "upload" | "lesson"
let selectedLesson   = null;       // lesson entry from localStorage

const el = id => document.getElementById(id);

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();

  if (!auth) {
    showToast("Sign in to create an arena.", "info");
    setTimeout(nav.login, 1200);
    return;
  }

  currentUser = auth.user;
  userProfile = auth.profile;

  setupFileUpload();
  setupGameModes();
  setupSourceTabs();

  el("createArenaBtn")?.addEventListener("click", createArena);
}

// ─── Source tabs ──────────────────────────────────────────────────────────────

function setupSourceTabs() {
  el("sourceTabUpload")?.addEventListener("click", () => switchSource("upload"));
  el("sourceTabTopic")?.addEventListener("click",  () => switchSource("topic"));
  el("sourceTabLesson")?.addEventListener("click", () => switchSource("lesson"));
}

function switchSource(source) {
  activeSource = source;

  el("sourceTabUpload")?.classList.toggle("auth-tab-active", source === "upload");
  el("sourceTabTopic")?.classList.toggle("auth-tab-active",  source === "topic");
  el("sourceTabLesson")?.classList.toggle("auth-tab-active", source === "lesson");

  el("uploadPanel")?.classList.toggle("hidden",  source !== "upload");
  el("topicPanel")?.classList.toggle("hidden",   source !== "topic");
  el("lessonsPanel")?.classList.toggle("hidden", source !== "lesson");

  if (source === "lesson") renderSavedLessons();
}

async function renderSavedLessons() {
  const lessons   = await getLessonsFromStorage(currentUser?.id);
  const container = el("savedLessonsList");
  if (!container) return;

  if (!lessons.length) {
    container.innerHTML = `
      <div class="flat-card" style="text-align:center;">
        <p class="muted">No lessons saved yet.</p>
        <a href="/lessons" class="btn" style="margin-top:14px;display:inline-block;">
          📚 Create a Lesson
        </a>
      </div>`;
    return;
  }

  container.innerHTML = lessons.map(l => `
    <div class="flat-card lesson-pick-card"
         data-lesson-id="${escapeAttr(l.id)}"
         style="cursor:pointer;transition:border-color .15s;border:3px solid var(--text);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <strong style="font-size:15px;">${escapeHTML(l.title)}</strong>
          <p class="muted" style="margin-top:4px;font-size:13px;">
            ${escapeHTML(l.language)} · ${new Date(l.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span class="lesson-pick-check" style="font-size:20px;display:none;">✅</span>
      </div>
    </div>`).join("");

  container.querySelectorAll(".lesson-pick-card").forEach(card => {
    card.addEventListener("click", () => {
      const id    = card.dataset.lessonId;
      const entry = lessons.find(l => l.id === id);
      selectedLesson = entry;

      container.querySelectorAll(".lesson-pick-card").forEach(c => {
        c.style.borderColor = "var(--text)";
        c.querySelector(".lesson-pick-check").style.display = "none";
      });

      card.style.borderColor = "var(--blue)";
      card.querySelector(".lesson-pick-check").style.display = "";
    });
  });
}

// ─── File upload ──────────────────────────────────────────────────────────────

function setupFileUpload() {
  const dropZone   = el("dropZone");
  const fileInput  = el("fileInput");
  const fileNameEl = el("fileName");
  const statusEl   = el("hostStatusText");

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
  if (activeSource === "lesson") await createArenaFromLesson();
  else if (activeSource === "topic") await createArenaFromTopic();
  else await createArenaFromFile();
}

// Path A — from uploaded document
async function createArenaFromFile() {
  const file      = el("fileInput").files[0];
  const hostName  = _hostName();
  const statusEl  = el("hostStatusText");
  const createBtn = el("createArenaBtn");

  if (!file) {
    statusEl.textContent = "Choose a document first.";
    showToast("Choose a document first.", "info");
    return;
  }

  showLoadingOverlay({
    title:   "Forging your arena...",
    message: "Reading your document.",
    steps:   ["Reading document", "Extracting concepts", "Generating challenges", "Checking quality", "Opening lobby"]
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

    await _openRoom(packData, hostName, file.name, packData.documentText || "");
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Something went wrong.";
    showToast(err.message || "Something went wrong.", "danger");
  } finally {
    hideLoadingOverlay();
    createBtn.disabled = false;
  }
}

// Path B — from a typed topic
async function createArenaFromTopic() {
  const topic     = el("createTopicInput")?.value.trim();
  const hostName  = _hostName();
  const statusEl  = el("hostStatusText");
  const createBtn = el("createArenaBtn");

  if (!topic) {
    showToast("Write a topic first.", "info");
    return;
  }

  showLoadingOverlay({
    title:   "Forging your arena...",
    message: "Generating challenges from topic.",
    steps:   ["Researching topic", "Generating challenges", "Checking quality", "Opening lobby"]
  });

  createBtn.disabled   = true;
  statusEl.textContent = "Starting...";

  try {
    const formData = new FormData();
    formData.append("topic",    topic);
    formData.append("gameMode", selectedGameMode);

    const packData = await api.generatePack(formData, msg => {
      statusEl.textContent = msg;
      updateLoadingOverlay(msg);
    });

    await _openRoom(packData, hostName, topic, "");
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Something went wrong.";
    showToast(err.message || "Something went wrong.", "danger");
  } finally {
    hideLoadingOverlay();
    createBtn.disabled = false;
  }
}

// Path C — from a saved lesson
async function createArenaFromLesson() {
  if (!selectedLesson) {
    showToast("Select a lesson first.", "info");
    return;
  }

  const hostName  = _hostName();
  const statusEl  = el("hostStatusText");
  const createBtn = el("createArenaBtn");

  showLoadingOverlay({
    title:   "Forging your arena...",
    message: "Generating challenges from lesson.",
    steps:   ["Reading lesson", "Generating challenges", "Checking quality", "Opening lobby"]
  });

  createBtn.disabled   = true;
  statusEl.textContent = "Starting...";

  try {
    const formData = new FormData();
    formData.append("documentText", selectedLesson.documentText);
    formData.append("gameMode",     selectedGameMode);

    const packData = await api.generatePack(formData, msg => {
      statusEl.textContent = msg;
      updateLoadingOverlay(msg);
    });

    await _openRoom(packData, hostName, selectedLesson.title, selectedLesson.documentText);
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Something went wrong.";
    showToast(err.message || "Something went wrong.", "danger");
  } finally {
    hideLoadingOverlay();
    createBtn.disabled = false;
  }
}

// ─── Shared room open ─────────────────────────────────────────────────────────

async function _openRoom(packData, hostName, docName, docText) {
  const statusEl = el("hostStatusText");

  updateLoadingOverlay("Opening lobby...", 92);
  statusEl.textContent = "Creating arena...";

  const { response: roomRes, data: roomData } = await api.createRoom(packData.pack, currentUser?.id || null);
  if (!roomRes.ok) {
    if (roomData.limitReached) {
      hideLoadingOverlay();
      showToast("Ai atins limita de 3 arene pe saptamana. Upgradeaza la Premium!", "danger");
      setTimeout(() => { window.location.href = "/pricing"; }, 1800);
      return;
    }
    throw new Error(roomData.error || "Could not create room.");
  }

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
    documentName:      docName,
    documentText:      docText
  }));

  nav.arena(roomCode);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function _hostName() {
  return el("hostNameInput")?.value.trim()
    || userProfile?.username
    || currentUser?.email?.split("@")[0]
    || "Guest";
}

function escapeHTML(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeAttr(v) {
  return String(v ?? "").replace(/"/g, "&quot;");
}

init();
