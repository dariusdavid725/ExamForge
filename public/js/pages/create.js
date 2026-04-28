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
  
  // Check if we have quiz content from learning path
  console.log('=== CREATE PAGE INIT ===');
  console.log('Current hash:', window.location.hash);
  console.log('Checking sessionStorage for quiz content...');
  
  const quizDocumentText = sessionStorage.getItem('quizDocumentText');
  const quizSourceName = sessionStorage.getItem('quizSourceName');
  
  console.log('quizSourceName:', quizSourceName);
  console.log('quizDocumentText exists:', !!quizDocumentText);
  console.log('quizDocumentText length:', quizDocumentText?.length);
  
  const hash = window.location.hash;
  
  if (hash === '#quiz-from-path' && quizDocumentText && quizSourceName) {
    console.log('✓ Found quiz content from learning path:', quizSourceName);
    console.log('Setting up UI for topic mode...');
    
    // Wait for DOM to be ready
    setTimeout(() => {
      // Switch to topic mode automatically
      const topicTab = el('sourceTabTopic');
      if (topicTab) {
        topicTab.click();
        console.log('✓ Switched to topic tab');
      }
      
      // Fill in the topic textarea with our content
      const topicInput = el('createTopicInput');
      if (topicInput) {
        topicInput.value = quizDocumentText;
        console.log('✓ Content set in topic textarea');
      }
      
      // Update UI to show it's from learning path
      const uploadPanel = el('uploadPanel');
      if (uploadPanel) {
        const notice = document.createElement('div');
        notice.style.cssText = 'padding:16px;background:#10b981;color:white;border-radius:12px;margin-bottom:16px;font-weight:700;text-align:center;';
        notice.innerHTML = `✓ Quiz content loaded from: <strong>${quizSourceName}</strong>`;
        uploadPanel.parentElement.insertBefore(notice, uploadPanel);
        console.log('✓ Notice added');
      }
      
      showToast(`✓ Content loaded from "${quizSourceName}"! Choose game mode and create arena.`, 'success');
      console.log('✓ Toast shown');
      
      // Clear sessionStorage
      sessionStorage.removeItem('quizDocumentText');
      sessionStorage.removeItem('quizSourceName');
      console.log('✓ SessionStorage cleared');
      
      // Remove hash
      window.history.replaceState(null, null, '/create');
      console.log('✓ Hash removed');
      
    }, 100);
    
  } else {
    console.log('No quiz content detected or wrong hash');
    console.log('- hash matches:', hash === '#quiz-from-path');
    console.log('- has quizDocumentText:', !!quizDocumentText);
    console.log('- has quizSourceName:', !!quizSourceName);
  }
}
      try {
        // Convert base64 back to File
        fetch(preloadedFileData)
          .then(res => {
            console.log('Fetch response received');
            return res.blob();
          })
          .then(blob => {
            console.log('Blob created, size:', blob.size);
            const file = new File([blob], preloadedFileName, { type: preloadedFileType || 'text/plain' });
            console.log('File created:', file.name, file.size, file.type);
            
            // Set the file in the upload input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            const fileInput = el('fileInput');
            
            console.log('File input element:', !!fileInput);
            console.log('All inputs:', document.querySelectorAll('input[type="file"]'));
            
            if (fileInput) {
              fileInput.files = dataTransfer.files;
              console.log('✓ File set in input, files.length:', fileInput.files.length);
              
              // Trigger change event
              const event = new Event('change', { bubbles: true });
              fileInput.dispatchEvent(event);
              console.log('✓ Change event dispatched');
              
              // Update UI to show file is loaded
              const fileLabel = document.querySelector('label[for="fileInput"]');
              const dropZone = el('dropZone');
              const fileName = el('fileName');
              console.log('File label element:', !!fileLabel);
              
              // Update UI - use fileName element that exists in HTML
              if (fileName) {
                fileName.textContent = `📄 ${preloadedFileName}`;
                console.log('✓ FileName updated');
              }
              
              // Update dropZone to show loaded state
              if (dropZone) {
                dropZone.style.borderColor = '#10b981';
                dropZone.style.background = 'rgba(16, 185, 129, 0.1)';
                console.log('✓ DropZone styled');
              }
              
              console.log('✓ UI updated');
              
              showToast('✓ File loaded! Choose your game mode and create arena.', 'success');
              console.log('✓ Toast shown');
            } else {
              console.error('❌ File input not found! Retrying in 500ms...');
              // Retry after a short delay
              setTimeout(loadPreloadedFile, 500);
              return;
            }
            
            // Clear sessionStorage
            sessionStorage.removeItem('preloadedFile');
            sessionStorage.removeItem('preloadedFileName');
            sessionStorage.removeItem('preloadedFileType');
            console.log('✓ SessionStorage cleared');
            
            // Remove hash
            window.history.replaceState(null, null, '/create');
            console.log('✓ Hash removed');
          })
          .catch(error => {
            console.error('❌ Error converting file:', error);
            showToast('Failed to load file. Please try again.', 'error');
          });
      } catch (error) {
        console.error('❌ Error in preload logic:', error);
        showToast('Failed to load file. Please try again.', 'error');
      }
    };
    
    // Start loading with a small delay to ensure DOM is ready
    setTimeout(loadPreloadedFile, 100);
    
  } else {
    console.log('No preloaded file detected or wrong hash');
    console.log('- hash matches:', hash === '#quiz-from-path');
    console.log('- has preloadedFileData:', !!preloadedFileData);
    console.log('- has preloadedFileName:', !!preloadedFileName);
  }
}

// Create arena from pre-provided content (e.g., from learning path)
async function createArenaFromContent(documentText, documentName) {
  try {
    showLoadingOverlay('Creating your quiz arena...', [
      { text: 'Analyzing content...', duration: 2000 },
      { text: 'Generating questions...', duration: 4000 },
      { text: 'Creating arena...', duration: 2000 }
    ]);
    
    const formData = new FormData();
    formData.append('documentText', documentText);
    formData.append('gameMode', selectedGameMode);
    
    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to create arena');
    }
    
    // Handle SSE response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sessionData = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.sessionId) {
              sessionData = data;
            }
          } catch (e) {
            console.log('Non-JSON line:', line);
          }
        }
      }
    }
    
    hideLoadingOverlay();
    
    if (sessionData && sessionData.sessionId) {
      showToast('Arena created! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = `/arena?session=${sessionData.sessionId}`;
      }, 800);
    } else {
      throw new Error('No session ID received');
    }
    
  } catch (error) {
    console.error('Error creating arena:', error);
    hideLoadingOverlay();
    showToast(error.message || 'Failed to create arena. Please try again.', 'error');
  }
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
  // Check limit BEFORE showing any loading overlay
  if (currentUser?.id) {
    try {
      const r = await fetch(`/api/stripe/plan-status?userId=${currentUser.id}`);
      const d = await r.json();
      if (r.ok && d.plan === "free" && (d.weeklyQuizzesUsed || 0) >= 3) {
        showToast("Ai atins limita de 3 arene pe saptamana. Upgradeaza la Premium!", "danger");
        setTimeout(() => { window.location.href = "/pricing"; }, 1800);
        return;
      }
    } catch { /* dacă fetch-ul pică, lăsăm serverul să prindă eroarea */ }
  }

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
