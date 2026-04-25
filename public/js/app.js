import * as dom from "./dom.js";
import { state } from "./state.js";
import * as api from "./api.js";
import {
  showScreen,
  updateTimerUI,
  renderChallenge,
  renderPlayerList,
  renderConceptPills,
  renderAnswerFeedback,
  renderResultPhase,
  renderMiniLeaderboard,
  renderPodium,
  renderRecoveryLesson
} from "./renderer.js";

// Must match backend constants
const QUESTION_TIME   = 20;
const RESULT_DURATION = 3;
const LB_DURATION     = 5;

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

function clearSession() {
  sessionStorage.removeItem("ef_session");
}

async function restoreSession() {
  const raw = sessionStorage.getItem("ef_session");
  if (!raw) return;
  let saved;
  try { saved = JSON.parse(raw); } catch { return; }
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

    if (data.status === "lobby") {
      await showLobby(); startLobbyPolling(); return;
    }

    if (data.status === "started" || data.status === "finished") {
      const { response: pr, data: pd } = await api.fetchPack(state.currentRoomCode);
      if (!pr.ok) { clearSession(); return; }

      state.currentPack   = pd.pack;
      state.questionTime  = pd.questionTime || 20;
      if (pd.startedAt) state.startedAt  = pd.startedAt;
      if (pd.endsAt)    state.arenaEndsAt = pd.endsAt;

      if (data.status === "finished") {
        await showLeaderboard();
      } else {
        dom.playerNameText.textContent = state.currentPlayerName || "Player";
        showScreen(dom.screens.challenge);
        startSyncedLoop();
      }
    }
  } catch { clearSession(); }
}

// ─── Synced game loop ─────────────────────────────────────────────────────────

function getArenaPhase() {
  if (!state.startedAt || !state.currentPack) return { phase: "waiting" };

  const elapsed     = Date.now() - state.startedAt;
  const total       = state.currentPack.challenges.length;
  const cycleMs     = (QUESTION_TIME + RESULT_DURATION + LB_DURATION) * 1000;
  const cycleIndex  = Math.floor(elapsed / cycleMs);
  const timeInCycle = elapsed % cycleMs;

  if (cycleIndex >= total) return { phase: "done" };

  if (timeInCycle < QUESTION_TIME * 1000) {
    return {
      phase: "question",
      challengeIndex: cycleIndex,
      timeLeft: Math.max(0, Math.ceil((QUESTION_TIME * 1000 - timeInCycle) / 1000))
    };
  }

  if (timeInCycle < (QUESTION_TIME + RESULT_DURATION) * 1000) {
    return {
      phase: "result",
      challengeIndex: cycleIndex,
      timeLeft: Math.max(0, Math.ceil(((QUESTION_TIME + RESULT_DURATION) * 1000 - timeInCycle) / 1000))
    };
  }

  return {
    phase: "leaderboard",
    challengeIndex: cycleIndex,
    timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000))
  };
}

function startSyncedLoop() {
  if (state.syncLoop) clearInterval(state.syncLoop);

  let trackedChallenge = -1;
  let trackedPhase     = "";

  state.syncLoop = setInterval(async () => {
    const arena = getArenaPhase();

    if (arena.phase === "done") {
      clearInterval(state.syncLoop); state.syncLoop = null;
      await showLeaderboard();
      return;
    }

    const phaseChanged     = arena.phase !== trackedPhase;
    const challengeChanged = arena.challengeIndex !== trackedChallenge;

    // ── QUESTION phase ────────────────────────────────────────────────────────
    if (arena.phase === "question") {
      if (phaseChanged || challengeChanged) {
        trackedPhase     = "question";
        trackedChallenge = arena.challengeIndex;

        state.currentChallengeIndex       = arena.challengeIndex;
        state.answeredCurrentChallenge    = false;
        state.lastSubmitResult            = null;
        state.cachedLeaderboard           = null;

        saveSession();

        const progress = Math.round((arena.challengeIndex / state.currentPack.challenges.length) * 100);
        dom.progressText.textContent = `${progress}%`;
        dom.progressBar.style.width  = `${progress}%`;
        dom.scoreText.textContent    = state.localScore;
        dom.challengeNumberText.textContent = arena.challengeIndex + 1;

        renderChallenge(submitCurrentAnswer);
      }

      if (!state.answeredCurrentChallenge) {
        state.timeLeft = arena.timeLeft;
        updateTimerUI();

        if (arena.timeLeft <= 0) {
          state.answeredCurrentChallenge = true;
          const challenge = state.currentPack.challenges[arena.challengeIndex];
          if (challenge.type === "order_steps") {
            state.selectedAnswer = [...state.currentOrderSelection];
          } else if (!state.selectedAnswer) {
            state.selectedAnswer = "__TIMEOUT__";
          }
          submitCurrentAnswer();
        }
      }
    }

    // ── RESULT phase ──────────────────────────────────────────────────────────
    if (arena.phase === "result") {
      if (phaseChanged || challengeChanged) {
        trackedPhase     = "result";
        trackedChallenge = arena.challengeIndex;
        const challenge  = state.currentPack.challenges[arena.challengeIndex];
        renderResultPhase(challenge, state.lastSubmitResult);
      }
    }

    // ── LEADERBOARD phase ─────────────────────────────────────────────────────
    if (arena.phase === "leaderboard") {
      if (phaseChanged || challengeChanged) {
        trackedPhase     = "leaderboard";
        trackedChallenge = arena.challengeIndex;

        // Fetch leaderboard once per cycle
        if (!state.cachedLeaderboard) {
          try {
            const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);
            if (response.ok) state.cachedLeaderboard = data;
          } catch { /* ignore */ }
        }

        const isLast = arena.challengeIndex >= state.currentPack.challenges.length - 1;
        renderMiniLeaderboard(state.cachedLeaderboard, state.currentPack, isLast);
      }

      // Update countdown
      const lbEl = window.lbCountdownText;
      if (lbEl) lbEl.textContent = `Next in ${arena.timeLeft}s`;
    }
  }, 200);
}

// ─── Answer submission ────────────────────────────────────────────────────────

function hasValidAnswer(challenge) {
  if (challenge.type === "order_steps") {
    return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  }
  return state.selectedAnswer !== null && state.selectedAnswer !== "";
}

async function submitCurrentAnswer() {
  const challenge = state.currentPack.challenges[state.currentChallengeIndex];

  if (challenge.type === "order_steps") {
    state.selectedAnswer = [...state.currentOrderSelection];
  }

  if (!hasValidAnswer(challenge)) return;
  if (state.answeredCurrentChallenge) return;

  state.answeredCurrentChallenge = true;
  dom.submitAnswerBtn.disabled = true;

  try {
    const { response, data } = await api.submitAnswer(
      state.currentRoomCode,
      state.currentPlayerId,
      state.currentChallengeIndex,
      state.selectedAnswer,
      state.timeLeft
    );

    if (!response.ok) throw new Error(data.error || "Could not submit answer.");

    state.localScore       = data.score;
    state.lastSubmitResult = data;
    dom.scoreText.textContent = state.localScore;

    // Show inline feedback (correct/wrong) — loop will transition to result phase
    renderAnswerFeedback(data, false);
    dom.nextChallengeBtn.classList.add("hidden");
  } catch (error) {
    state.answeredCurrentChallenge = false;
    dom.submitAnswerBtn.disabled   = false;
    console.error(error);
    dom.feedbackTitle.textContent  = "Eroare la trimitere";
    dom.explanationText.textContent = error.message || "Încearcă din nou.";
    dom.feedbackBox.classList.remove("hidden");
  }
}

// ─── Room lifecycle ───────────────────────────────────────────────────────────

async function loadPackAndStart() {
  if (state.packLoading) return;
  state.packLoading = true;
  if (state.lobbyPoll) clearInterval(state.lobbyPoll);

  const { response, data } = await api.fetchPack(state.currentRoomCode);

  if (!response.ok) {
    dom.lobbyStatusText.textContent = data.error || "Pack not available.";
    state.packLoading = false;
    return;
  }

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

  const joinLink = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;
  dom.joinLinkText.textContent = joinLink;
  QRCode.toCanvas(dom.qrCanvas, joinLink, { width: 190, margin: 1 });

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

  if (data.status === "started" && !state.currentPack) {
    await loadPackAndStart();
  }
}

function startLobbyPolling() {
  if (state.lobbyPoll) clearInterval(state.lobbyPoll);
  state.lobbyPoll = setInterval(refreshRoomInfo, 1200);
}

async function showLeaderboard() {
  if (state.syncLoop)           { clearInterval(state.syncLoop);           state.syncLoop = null; }
  if (state.arenaEndWatcher)    { clearInterval(state.arenaEndWatcher);    state.arenaEndWatcher = null; }
  if (state.waitingResultsTimer){ clearInterval(state.waitingResultsTimer);state.waitingResultsTimer = null; }

  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);
  if (!response.ok) { alert(data.error || "Could not load leaderboard."); return; }

  showScreen(dom.screens.leaderboard);
  renderPodium(data, state.currentPack);
}

// ─── Main actions ─────────────────────────────────────────────────────────────

async function createArena() {
  const file     = dom.fileInput.files[0];
  const hostName = dom.hostNameInput.value.trim() || "Host";

  if (!file) { dom.hostStatusText.textContent = "Choose a document first."; return; }

  dom.createArenaBtn.disabled     = true;
  dom.hostStatusText.textContent  = "Starting...";

  try {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("gameMode", state.selectedGameMode);

    const packData = await api.generatePack(formData, msg => { dom.hostStatusText.textContent = msg; });

    dom.hostStatusText.textContent = "Creating arena...";
    const { response: rr, data: rd } = await api.createRoom(packData.pack);
    if (!rr.ok) throw new Error(rd.error || "Could not create room.");

    state.currentRoomCode = rd.code;
    state.isHost          = true;

    await joinRoomWithName(state.currentRoomCode, hostName);
    await showLobby();
    startLobbyPolling();
  } catch (error) {
    console.error(error);
    dom.hostStatusText.textContent = error.message || "Something went wrong.";
  } finally {
    dom.createArenaBtn.disabled = false;
  }
}

async function joinArena() {
  const code = dom.joinCodeInput.value.trim().toUpperCase();
  const name = dom.joinNameInput.value.trim();

  if (!code || !name) { dom.joinStatusText.textContent = "Enter room code and nickname."; return; }

  dom.joinArenaBtn.disabled       = true;
  dom.joinStatusText.textContent  = "Joining room...";

  try {
    state.isHost = false;
    await joinRoomWithName(code, name);
    state.currentRoomCode = code;
    await showLobby();
    startLobbyPolling();
  } catch (error) {
    console.error(error);
    dom.joinStatusText.textContent = error.message || "Could not join room.";
  } finally {
    dom.joinArenaBtn.disabled = false;
  }
}

async function joinRoomWithName(code, name) {
  const { response, data } = await api.joinRoom(code, name);
  if (!response.ok) throw new Error(data.error || "Could not join room.");
  state.currentPlayerId   = data.playerId;
  state.currentPlayerName = name;
  saveSession();
}

async function startArena() {
  dom.startArenaBtn.disabled      = true;
  dom.lobbyStatusText.textContent = "Starting...";

  try {
    const { response, data } = await api.startRoom(state.currentRoomCode);
    if (!response.ok) throw new Error(data.error || "Could not start arena.");
    state.arenaEndsAt = data.endsAt;
    await loadPackAndStart();
  } catch (error) {
    console.error(error);
    dom.lobbyStatusText.textContent = error.message || "Could not start arena.";
  } finally {
    dom.startArenaBtn.disabled = false;
  }
}

async function copyJoinLink() {
  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;
  try { await navigator.clipboard.writeText(link); dom.lobbyStatusText.textContent = "Link copied."; }
  catch { dom.lobbyStatusText.textContent = link; }
}

async function generateRecoveryLesson() {
  dom.generateLessonBtn.disabled      = true;
  dom.generateLessonBtn.textContent   = "Generating...";
  dom.lessonBox.innerHTML             = "";

  try {
    const { response, data } = await api.generateLesson(state.currentRoomCode, state.currentPlayerId);
    if (!response.ok) throw new Error(data.error || "Could not generate lesson.");
    renderRecoveryLesson(data.lesson);
  } catch (error) {
    const p = document.createElement("p");
    p.className   = "muted";
    p.textContent = error.message || "Could not generate lesson.";
    dom.lessonBox.appendChild(p);
  } finally {
    dom.generateLessonBtn.disabled    = false;
    dom.generateLessonBtn.textContent = "Generate AI lesson";
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

history.replaceState({ screen: "home" }, "", window.location.href);

window.addEventListener("popstate", event => {
  const name   = event.state?.screen || "home";
  const screen = dom.screens[name] || dom.screens.home;

  if (state.syncLoop)        clearInterval(state.syncLoop);
  if (state.lobbyPoll)       clearInterval(state.lobbyPoll);
  if (state.arenaEndWatcher) clearInterval(state.arenaEndWatcher);

  showScreen(screen, false);

  if (name === "lobby"       && state.currentRoomCode) { startLobbyPolling(); refreshRoomInfo(); }
  if (name === "leaderboard" && state.currentRoomCode) { showLeaderboard(); }
});

// ─── Event listeners ─────────────────────────────────────────────────────────

dom.dropZone.addEventListener("click",    () => dom.fileInput.click());
dom.dropZone.addEventListener("dragover", e => e.preventDefault());
dom.dropZone.addEventListener("dragleave",() => { dom.dropZone.style.borderColor = "var(--text)"; });
dom.dropZone.addEventListener("drop",     e => {
  e.preventDefault();
  dom.dropZone.style.borderColor = "var(--text)";
  const file = e.dataTransfer.files[0];
  if (!file) return;
  dom.fileInput.files = e.dataTransfer.files;
  dom.fileName.textContent       = file.name;
  dom.hostStatusText.textContent = "File selected. Ready to create AI arena.";
});

dom.fileInput.addEventListener("change", () => {
  const file = dom.fileInput.files[0];
  if (file) { dom.fileName.textContent = file.name; dom.hostStatusText.textContent = "File selected."; }
});

dom.createArenaBtn.addEventListener("click",  createArena);
dom.joinArenaBtn.addEventListener("click",    joinArena);
dom.startArenaBtn.addEventListener("click",   startArena);
dom.copyLinkBtn.addEventListener("click",     copyJoinLink);
dom.submitAnswerBtn.addEventListener("click", submitCurrentAnswer);
dom.viewLeaderboardBtn.addEventListener("click", showLeaderboard);
dom.generateLessonBtn.addEventListener("click",  generateRecoveryLesson);

document.querySelectorAll(".mode-option").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.selectedGameMode = btn.dataset.mode;
  });
});

// ─── URL param ────────────────────────────────────────────────────────────────

const roomParam = new URLSearchParams(window.location.search).get("room");
if (roomParam) {
  dom.joinCodeInput.value        = roomParam.toUpperCase();
  dom.joinStatusText.textContent = "Room code detected. Enter your nickname to join.";
}

// ─── Restore session ─────────────────────────────────────────────────────────

restoreSession();
