import * as dom from "./dom.js";
import { state } from "./state.js";
import * as api from "./api.js";
import { getSession, login, register } from "./auth.js";
import { getSupabase, getProfile } from "./supabaseClient.js";
import { saveGameSession, renderDashboard, loadNotificationCount } from "./dashboard.js";
import {
  showScreen, updateTimerUI, renderChallenge, renderPlayerList,
  renderConceptPills, renderLockedState, renderResultPhase,
  renderMiniLeaderboard, renderAnswerFeedback, renderPodium, renderRecoveryLesson
} from "./renderer.js";

const QUESTION_TIME   = 20;
const RESULT_DURATION = 3;
const LB_DURATION     = 5;

// ─── Auth initialization ──────────────────────────────────────────────────────

async function initApp() {
  // Show auth screen immediately while loading
  showScreen(dom.screens.auth, false);
  setupAuthListeners();

  try {
    const session = await getSession();
    if (!session) return; // already showing auth

    state.currentUser  = session.user;
    state.userProfile  = await getProfile(session.user.id);
    setupHeader();
    await showDashboard();
  } catch (err) {
    console.error("initApp error:", err);
    // Stay on auth screen — user can still log in
  }
}

function setupHeader() {
  if (!state.currentUser) return;
  const p       = state.userProfile;
  const letter  = (p?.username || state.currentUser.email || "U")[0].toUpperCase();
  const color   = p?.avatar_color || "#4f46e5";
  const streak  = p?.streak_count || 0;

  if (dom.headerUserArea) {
    dom.headerUserArea.innerHTML = `
      <div class="header-avatar" style="background:${color}">${letter}</div>
      <span class="header-username">${p?.username || ""}</span>
    `;
    dom.headerUserArea.style.display = "flex";
    dom.headerUserArea.addEventListener("click", () => showDashboard());
  }
  if (dom.headerStreak) {
    dom.headerStreak.textContent = `${streak}🔥`;
    dom.headerStreak.style.display = streak > 0 ? "" : "none";
  }

  // Bell notifications
  loadNotificationCount(state.currentUser.id).then(count => {
    if (dom.bellBadge) {
      dom.bellBadge.textContent = count;
      dom.bellBadge.style.display = count > 0 ? "" : "none";
    }
  });
}

async function showDashboard() {
  showScreen(dom.screens.dashboard, false);
  await renderDashboard(dom.dashboardContent, state.currentUser, state.userProfile, {
    onCreateArena: () => { showScreen(dom.screens.home); },
    onJoinArena:   () => { showScreen(dom.screens.home); dom.joinCodeInput?.focus(); },
    onHistory:     () => showHistoryScreen()
  });
}

async function showHistoryScreen() {
  showScreen(dom.screens.history, false);
  const sb = await getSupabase();
  const { data: sessions } = await sb
    .from("game_sessions")
    .select("*, game_results(*)")
    .eq("host_id", state.currentUser.id)
    .order("played_at", { ascending: false });

  const container = document.getElementById("historyContent");
  if (!container) return;
  container.innerHTML = sessions && sessions.length ? sessions.map(s => `
    <div class="card" style="cursor:pointer;" data-id="${s.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3>${s.title}</h3>
          <p class="muted" style="font-size:13px;margin-top:4px;">${s.category} · ${s.player_count} players · ${new Date(s.played_at).toLocaleDateString()}</p>
        </div>
        <span class="pill">${s.category}</span>
      </div>
    </div>
  `).join("") : `<p class="muted">No quizzes yet.</p>`;
}

// ─── Auth listeners ───────────────────────────────────────────────────────────

function setupAuthListeners() {
  dom.authTabLogin?.addEventListener("click", () => {
    dom.authTabLogin.classList.add("auth-tab-active");
    dom.authTabRegister.classList.remove("auth-tab-active");
    dom.loginForm.classList.remove("hidden");
    dom.registerForm.classList.add("hidden");
  });

  dom.authTabRegister?.addEventListener("click", () => {
    dom.authTabRegister.classList.add("auth-tab-active");
    dom.authTabLogin.classList.remove("auth-tab-active");
    dom.registerForm.classList.remove("hidden");
    dom.loginForm.classList.add("hidden");
  });

  dom.loginBtn?.addEventListener("click", async () => {
    dom.loginError.textContent = "";
    dom.loginBtn.disabled      = true;
    try {
      const user = await login(dom.loginEmail.value.trim(), dom.loginPassword.value);
      state.currentUser  = user;
      state.userProfile  = await getProfile(user.id);
      setupHeader();
      await showDashboard();
    } catch (e) {
      dom.loginError.textContent = e.message;
    } finally {
      dom.loginBtn.disabled = false;
    }
  });

  dom.registerBtn?.addEventListener("click", async () => {
    dom.registerError.textContent = "";
    dom.registerBtn.disabled      = true;
    try {
      const user = await register(
        dom.registerEmail.value.trim(),
        dom.registerPassword.value,
        dom.registerUsername.value.trim()
      );
      state.currentUser  = user;
      state.userProfile  = await getProfile(user.id);
      setupHeader();
      await showDashboard();
    } catch (e) {
      dom.registerError.textContent = e.message;
    } finally {
      dom.registerBtn.disabled = false;
    }
  });
}

// ─── Session persistence ──────────────────────────────────────────────────────

function saveSession() {
  sessionStorage.setItem("ef_session", JSON.stringify({
    currentRoomCode:   state.currentRoomCode,
    currentPlayerId:   state.currentPlayerId,
    currentPlayerName: state.currentPlayerName,
    isHost:            state.isHost,
    localScore:        state.localScore,
    questionTime:      state.questionTime,
    startedAt:         state.startedAt,
    arenaEndsAt:       state.arenaEndsAt
  }));
}

function clearSession() { sessionStorage.removeItem("ef_session"); }

async function restoreSession() {
  const raw = sessionStorage.getItem("ef_session");
  if (!raw) return;
  let saved; try { saved = JSON.parse(raw); } catch { return; }
  if (!saved.currentRoomCode || !saved.currentPlayerId) return;

  Object.assign(state, {
    currentRoomCode:   saved.currentRoomCode,
    currentPlayerId:   saved.currentPlayerId,
    currentPlayerName: saved.currentPlayerName,
    isHost:            saved.isHost,
    localScore:        saved.localScore || 0,
    questionTime:      saved.questionTime || 20,
    startedAt:         saved.startedAt,
    arenaEndsAt:       saved.arenaEndsAt
  });

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);
    if (!response.ok) { clearSession(); return; }
    if (data.status === "lobby") { await showLobby(); startLobbyPolling(); return; }
    if (data.status === "started" || data.status === "finished") {
      const { response: pr, data: pd } = await api.fetchPack(state.currentRoomCode);
      if (!pr.ok) { clearSession(); return; }
      state.currentPack  = pd.pack;
      state.questionTime = pd.questionTime || 20;
      if (pd.startedAt) state.startedAt   = pd.startedAt;
      if (pd.endsAt)    state.arenaEndsAt = pd.endsAt;
      if (data.status === "finished") { await showLeaderboard(); }
      else { dom.playerNameText.textContent = state.currentPlayerName || "Player"; showScreen(dom.screens.challenge); startSyncedLoop(); }
    }
  } catch { clearSession(); }
}

// ─── Synced game loop ─────────────────────────────────────────────────────────

function getTimedPhase() {
  if (!state.startedAt || !state.currentPack) return { phase: "waiting" };
  const elapsed     = Date.now() - state.startedAt;
  const total       = state.currentPack.challenges.length;
  const cycleMs     = (QUESTION_TIME + RESULT_DURATION + LB_DURATION) * 1000;
  const cycleIndex  = Math.floor(elapsed / cycleMs);
  const timeInCycle = elapsed % cycleMs;
  if (cycleIndex >= total) return { phase: "done" };
  if (timeInCycle < QUESTION_TIME * 1000)
    return { phase: "question", challengeIndex: cycleIndex, timeLeft: Math.max(0, Math.ceil((QUESTION_TIME * 1000 - timeInCycle) / 1000)) };
  if (timeInCycle < (QUESTION_TIME + RESULT_DURATION) * 1000)
    return { phase: "result", challengeIndex: cycleIndex, timeLeft: Math.max(0, Math.ceil(((QUESTION_TIME + RESULT_DURATION) * 1000 - timeInCycle) / 1000)) };
  return { phase: "leaderboard", challengeIndex: cycleIndex, timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000)) };
}

function getArenaPhase() {
  const timed = getTimedPhase();
  if (timed.phase === "question" && state.earlyResult)
    return { ...timed, phase: "result", timeLeft: RESULT_DURATION };
  if (timed.phase === "question" && state.currentChallengeIndex !== timed.challengeIndex)
    state.earlyResult = false;
  return timed;
}

function startSyncedLoop() {
  if (state.syncLoop) clearInterval(state.syncLoop);
  let trackedChallenge = -1, trackedPhase = "";

  state.syncLoop = setInterval(async () => {
    const arena = getArenaPhase();
    if (arena.phase === "done") {
      clearInterval(state.syncLoop); state.syncLoop = null;
      await showLeaderboard(); return;
    }

    const phaseChanged     = arena.phase !== trackedPhase;
    const challengeChanged = arena.challengeIndex !== trackedChallenge;

    if (arena.phase === "question") {
      if (phaseChanged || challengeChanged) {
        trackedPhase = "question"; trackedChallenge = arena.challengeIndex;
        state.currentChallengeIndex    = arena.challengeIndex;
        state.answeredCurrentChallenge = false;
        state.lastSubmitResult         = null;
        state.cachedLeaderboard        = null;
        state.earlyResult              = false;
        state.lastPollTime             = 0;
        saveSession();
        const pct = Math.round((arena.challengeIndex / state.currentPack.challenges.length) * 100);
        dom.progressText.textContent = `${pct}%`;
        dom.progressBar.style.width  = `${pct}%`;
        dom.scoreText.textContent    = state.localScore;
        dom.challengeNumberText.textContent = arena.challengeIndex + 1;
        renderChallenge(submitCurrentAnswer);
      }
      state.timeLeft = arena.timeLeft; updateTimerUI();
      if (!state.answeredCurrentChallenge && arena.timeLeft <= 0) {
        state.answeredCurrentChallenge = true;
        const ch = state.currentPack.challenges[arena.challengeIndex];
        if (ch.type === "order_steps") state.selectedAnswer = [...state.currentOrderSelection];
        else if (!state.selectedAnswer) state.selectedAnswer = "__TIMEOUT__";
        submitCurrentAnswer();
      } else if (state.answeredCurrentChallenge) {
        const now = Date.now();
        if (now - state.lastPollTime > 900) {
          state.lastPollTime = now;
          try {
            const { response, data } = await api.fetchRoom(state.currentRoomCode);
            if (response.ok && data.allAnsweredCurrentQuestion) state.earlyResult = true;
          } catch { /* ignore */ }
        }
      }
    }

    if (arena.phase === "result") {
      if (phaseChanged || challengeChanged || (state.earlyResult && trackedPhase !== "result")) {
        trackedPhase = "result"; trackedChallenge = arena.challengeIndex;
        renderResultPhase(state.currentPack.challenges[arena.challengeIndex], state.lastSubmitResult);
      }
    }

    if (arena.phase === "leaderboard") {
      if (phaseChanged || challengeChanged) {
        trackedPhase = "leaderboard"; trackedChallenge = arena.challengeIndex;
        state.earlyResult = false;
        if (!state.cachedLeaderboard) {
          try {
            const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);
            if (response.ok) state.cachedLeaderboard = data;
          } catch { /* ignore */ }
        }
        const isLast = arena.challengeIndex >= state.currentPack.challenges.length - 1;
        renderMiniLeaderboard(state.cachedLeaderboard, state.currentPack, isLast);
      }
      const el = document.getElementById("lbCountdown");
      if (el) el.textContent = `Next in ${arena.timeLeft}s`;
    }
  }, 200);
}

// ─── Answer submission ────────────────────────────────────────────────────────

function hasValidAnswer(ch) {
  if (ch.type === "order_steps")    return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  if (ch.type === "multiple_select") return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  if (ch.type === "matching")       return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  return state.selectedAnswer !== null && state.selectedAnswer !== "";
}

async function submitCurrentAnswer() {
  const ch = state.currentPack.challenges[state.currentChallengeIndex];
  if (ch.type === "order_steps") state.selectedAnswer = [...state.currentOrderSelection];
  if (!hasValidAnswer(ch)) return;
  if (state.answeredCurrentChallenge) return;
  state.answeredCurrentChallenge = true;
  dom.submitAnswerBtn.disabled   = true;
  renderLockedState();

  try {
    const { response, data } = await api.submitAnswer(
      state.currentRoomCode, state.currentPlayerId,
      state.currentChallengeIndex, state.selectedAnswer, state.timeLeft
    );
    if (!response.ok) throw new Error(data.error || "Could not submit answer.");
    state.localScore       = data.score;
    state.lastSubmitResult = data;
    dom.scoreText.textContent = state.localScore;
  } catch (error) {
    state.answeredCurrentChallenge = false;
    dom.submitAnswerBtn.disabled   = false;
    console.error(error);
  }
}

// ─── Room lifecycle ───────────────────────────────────────────────────────────

async function loadPackAndStart() {
  if (state.packLoading) return;
  state.packLoading = true;
  if (state.lobbyPoll) clearInterval(state.lobbyPoll);
  const { response, data } = await api.fetchPack(state.currentRoomCode);
  if (!response.ok) { dom.lobbyStatusText.textContent = data.error || "Pack not available."; state.packLoading = false; return; }
  state.currentPack  = data.pack;
  state.startedAt    = data.startedAt;
  state.arenaEndsAt  = data.endsAt;
  state.questionTime = data.questionTime || 20;
  state.localScore   = 0;
  saveSession();
  dom.playerNameText.textContent = state.currentPlayerName || "Player";
  showScreen(dom.screens.challenge);
  startSyncedLoop();
}

// ─── Screens ──────────────────────────────────────────────────────────────────

async function showLobby() {
  showScreen(dom.screens.lobby);
  dom.roomCodeText.textContent = state.currentRoomCode;
  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;
  dom.joinLinkText.textContent = link;
  QRCode.toCanvas(dom.qrCanvas, link, { width: 190, margin: 1 });
  dom.startArenaBtn.classList.toggle("hidden", !state.isHost);
  dom.lobbyStatusText.textContent = state.isHost ? "Waiting for players." : "Waiting for host to start.";
  await refreshRoomInfo();
}

async function refreshRoomInfo() {
  const { response, data } = await api.fetchRoom(state.currentRoomCode);
  if (!response.ok) { dom.lobbyStatusText.textContent = data.error || "Room not found."; return; }
  dom.roomTitleText.textContent   = data.packTitle || "Generated arena";
  dom.roomSummaryText.textContent = data.packSummary || "";
  renderPlayerList(data.players);
  renderConceptPills(data.concepts);
  if (data.endsAt) state.arenaEndsAt = data.endsAt;
  if (data.status === "started" && !state.currentPack) await loadPackAndStart();
}

function startLobbyPolling() {
  if (state.lobbyPoll) clearInterval(state.lobbyPoll);
  state.lobbyPoll = setInterval(refreshRoomInfo, 1200);
}

async function showLeaderboard() {
  if (state.syncLoop)     { clearInterval(state.syncLoop);     state.syncLoop = null; }
  if (state.arenaEndWatcher) { clearInterval(state.arenaEndWatcher); state.arenaEndWatcher = null; }
  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);
  if (!response.ok) { alert(data.error || "Could not load leaderboard."); return; }
  showScreen(dom.screens.leaderboard);
  renderPodium(data, state.currentPack);

  // Save to history if logged in and host
  if (state.currentUser && state.isHost && state.currentPack) {
    saveGameSession({
      user: state.currentUser,
      profile: state.userProfile,
      pack: state.currentPack,
      roomCode: state.currentRoomCode,
      documentName: state.documentName,
      documentText: state.documentText,
      leaderboardData: data
    });
  }
}

// ─── Main actions ─────────────────────────────────────────────────────────────

async function createArena() {
  if (!state.currentUser) { showScreen(dom.screens.auth); return; }
  const file     = dom.fileInput.files[0];
  const hostName = dom.hostNameInput.value.trim() || state.userProfile?.username || "Host";
  if (!file) { dom.hostStatusText.textContent = "Choose a document first."; return; }
  dom.createArenaBtn.disabled = true; dom.hostStatusText.textContent = "Starting...";
  try {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("gameMode", state.selectedGameMode);
    const packData = await api.generatePack(formData, msg => { dom.hostStatusText.textContent = msg; });

    state.documentName = file.name;
    state.documentText = packData.documentText || "";

    // Conspect in background
    if (packData.documentText && packData.documentText.length > 200) {
      fetch("/api/conspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: packData.documentText })
      }).then(r => r.json()).then(d => {
        if (d.conspect) state.currentPack && (state.currentPack.conspect = d.conspect);
      }).catch(() => {});
    }

    dom.hostStatusText.textContent = "Creating arena...";
    const { response: rr, data: rd } = await api.createRoom(packData.pack);
    if (!rr.ok) throw new Error(rd.error || "Could not create room.");
    state.currentRoomCode = rd.code; state.isHost = true;
    await joinRoomWithName(state.currentRoomCode, hostName);
    await showLobby(); startLobbyPolling();
  } catch (e) { console.error(e); dom.hostStatusText.textContent = e.message || "Something went wrong."; }
  finally { dom.createArenaBtn.disabled = false; }
}

async function joinArena() {
  const code = dom.joinCodeInput.value.trim().toUpperCase();
  const name = dom.joinNameInput.value.trim() || state.userProfile?.username || "";
  if (!code || !name) { dom.joinStatusText.textContent = "Enter room code and nickname."; return; }
  dom.joinArenaBtn.disabled = true; dom.joinStatusText.textContent = "Joining...";
  try {
    state.isHost = false;
    await joinRoomWithName(code, name);
    state.currentRoomCode = code;
    await showLobby(); startLobbyPolling();
  } catch (e) { console.error(e); dom.joinStatusText.textContent = e.message || "Could not join room."; }
  finally { dom.joinArenaBtn.disabled = false; }
}

async function joinRoomWithName(code, name) {
  const { response, data } = await api.joinRoom(code, name);
  if (!response.ok) throw new Error(data.error || "Could not join room.");
  state.currentPlayerId = data.playerId; state.currentPlayerName = name; saveSession();
}

async function startArena() {
  dom.startArenaBtn.disabled = true; dom.lobbyStatusText.textContent = "Starting...";
  try {
    const { response, data } = await api.startRoom(state.currentRoomCode);
    if (!response.ok) throw new Error(data.error || "Could not start arena.");
    state.arenaEndsAt = data.endsAt;
    await loadPackAndStart();
  } catch (e) { console.error(e); dom.lobbyStatusText.textContent = e.message || "Could not start."; }
  finally { dom.startArenaBtn.disabled = false; }
}

async function copyJoinLink() {
  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;
  try { await navigator.clipboard.writeText(link); dom.lobbyStatusText.textContent = "Link copied."; }
  catch { dom.lobbyStatusText.textContent = link; }
}

async function generateRecoveryLesson() {
  dom.generateLessonBtn.disabled = true; dom.generateLessonBtn.textContent = "Generating...";
  dom.lessonBox.innerHTML = "";
  try {
    const { response, data } = await api.generateLesson(state.currentRoomCode, state.currentPlayerId);
    if (!response.ok) throw new Error(data.error || "Could not generate lesson.");
    renderRecoveryLesson(data.lesson);
  } catch (e) {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = e.message || "Could not generate.";
    dom.lessonBox.appendChild(p);
  } finally { dom.generateLessonBtn.disabled = false; dom.generateLessonBtn.textContent = "Generate AI lesson"; }
}

// ─── History ──────────────────────────────────────────────────────────────────

history.replaceState({ screen: "home" }, "", window.location.href);
window.addEventListener("popstate", event => {
  const name   = event.state?.screen || "home";
  const screen = dom.screens[name]   || dom.screens.home;
  if (state.syncLoop)     clearInterval(state.syncLoop);
  if (state.lobbyPoll)    clearInterval(state.lobbyPoll);
  showScreen(screen, false);
  if (name === "lobby"       && state.currentRoomCode) { startLobbyPolling(); refreshRoomInfo(); }
  if (name === "leaderboard" && state.currentRoomCode) showLeaderboard();
});

// ─── Event listeners ──────────────────────────────────────────────────────────

dom.dropZone?.addEventListener("click",    () => dom.fileInput.click());
dom.dropZone?.addEventListener("dragover", e => e.preventDefault());
dom.dropZone?.addEventListener("dragleave",() => { if(dom.dropZone) dom.dropZone.style.borderColor = "var(--text)"; });
dom.dropZone?.addEventListener("drop", e => {
  e.preventDefault();
  if(dom.dropZone) dom.dropZone.style.borderColor = "var(--text)";
  const file = e.dataTransfer.files[0]; if (!file) return;
  dom.fileInput.files = e.dataTransfer.files;
  if(dom.fileName) dom.fileName.textContent = file.name;
  if(dom.hostStatusText) dom.hostStatusText.textContent = "File selected.";
});
dom.fileInput?.addEventListener("change", () => {
  const file = dom.fileInput.files[0];
  if (file) { if(dom.fileName) dom.fileName.textContent = file.name; if(dom.hostStatusText) dom.hostStatusText.textContent = "File selected."; }
});

dom.createArenaBtn?.addEventListener("click",  createArena);
dom.joinArenaBtn?.addEventListener("click",    joinArena);
dom.startArenaBtn?.addEventListener("click",   startArena);
dom.copyLinkBtn?.addEventListener("click",     copyJoinLink);
dom.submitAnswerBtn?.addEventListener("click", submitCurrentAnswer);
dom.viewLeaderboardBtn?.addEventListener("click", showLeaderboard);
dom.generateLessonBtn?.addEventListener("click",  generateRecoveryLesson);

document.querySelectorAll(".mode-option").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected"); state.selectedGameMode = btn.dataset.mode;
  });
});

// Back to dashboard button
document.getElementById("backToDashboard")?.addEventListener("click", () => showDashboard());
document.getElementById("backToDashboardFromHistory")?.addEventListener("click", () => showDashboard());

// URL room param
const roomParam = new URLSearchParams(window.location.search).get("room");
if (roomParam && dom.joinCodeInput) {
  dom.joinCodeInput.value        = roomParam.toUpperCase();
  if(dom.joinStatusText) dom.joinStatusText.textContent = "Room code detected. Enter your nickname to join.";
}

// ─── Start ────────────────────────────────────────────────────────────────────

initApp().then(() => restoreSession());
