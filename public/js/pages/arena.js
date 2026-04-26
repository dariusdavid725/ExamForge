import { state } from "../state.js";
import { installFeedback, showToast, showConfirm, showNotice } from "../uiFeedback.js";
import { installThemeToggle } from "../theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { saveGameSession } from "../dashboard.js";
import { showInviteFriendsModal } from "../roomInvites.js";
import {
  updateTimerUI,
  renderChallenge,
  renderPlayerList,
  renderConceptPills,
  renderLockedState,
  renderResultPhase,
  renderMiniLeaderboard,
  renderPodium,
  renderRecoveryLesson
} from "../renderer.js";
import * as api from "../api.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTION_TIME   = 20;
const RESULT_DURATION = 3;
const LB_DURATION     = 5;

// ─── Section switching ────────────────────────────────────────────────────────

function showSection(id) {
  ["lobbyScreen", "challengeScreen", "waitingResultsScreen", "leaderboardScreen"].forEach(sid => {
    document.getElementById(sid)?.classList.add("hidden");
  });
  document.getElementById(id)?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── Clock sync ───────────────────────────────────────────────────────────────

function syncClock(serverNow) {
  if (typeof serverNow === "number") state.serverClockOffset = serverNow - Date.now();
}

function serverNow() {
  return Date.now() + Number(state.serverClockOffset || 0);
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
    arenaEndsAt:       state.arenaEndsAt,
    serverClockOffset: state.serverClockOffset || 0,
    documentName:      state.documentName,
    documentText:      state.documentText
  }));
}

function clearSession() { sessionStorage.removeItem("ef_session"); }

function resetRoomState() {
  Object.assign(state, {
    currentRoomCode: null, currentPlayerId: null, currentPlayerName: null,
    isHost: false, localScore: 0, questionTime: QUESTION_TIME,
    startedAt: null, arenaEndsAt: null, currentPack: null,
    currentChallengeIndex: 0, serverChallengeIndex: 0, serverPhase: null,
    answeredCurrentChallenge: false, submittingAnswer: false,
    lastSubmitResult: null, cachedLeaderboard: null,
    selectedAnswer: null, currentOrderSelection: []
  });
}

// ─── Room sync ────────────────────────────────────────────────────────────────

function applyRoomSync(data) {
  if (!data) return;
  syncClock(data.serverNow);
  if (data.startedAt)     state.startedAt    = Number(data.startedAt);
  if (data.endsAt)        state.arenaEndsAt  = Number(data.endsAt);
  if (data.questionTime)  state.questionTime = Number(data.questionTime);
  if (typeof data.currentChallengeIndex === "number") state.serverChallengeIndex = data.currentChallengeIndex;
  if (data.phase)         state.serverPhase  = data.phase;
  if (Array.isArray(data.players)) state.playerCount = data.players.length;
}

function getTimedPhase() {
  if (!state.startedAt || !state.currentPack) {
    return { phase: "waiting", challengeIndex: 0, timeLeft: state.questionTime || QUESTION_TIME };
  }

  const questionTime = state.questionTime || QUESTION_TIME;
  const elapsed      = Math.max(0, serverNow() - Number(state.startedAt));
  const total        = state.currentPack.challenges.length;
  const cycleMs      = (questionTime + RESULT_DURATION + LB_DURATION) * 1000;
  const cycleIndex   = Math.floor(elapsed / cycleMs);
  const timeInCycle  = elapsed % cycleMs;

  if (cycleIndex >= total) return { phase: "done", challengeIndex: total - 1, timeLeft: 0 };

  if (timeInCycle < questionTime * 1000) {
    return { phase: "question", challengeIndex: cycleIndex, timeLeft: Math.max(0, Math.ceil((questionTime * 1000 - timeInCycle) / 1000)) };
  }
  if (timeInCycle < (questionTime + RESULT_DURATION) * 1000) {
    return { phase: "result", challengeIndex: cycleIndex, timeLeft: Math.max(0, Math.ceil(((questionTime + RESULT_DURATION) * 1000 - timeInCycle) / 1000)) };
  }
  return { phase: "leaderboard", challengeIndex: cycleIndex, timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000)) };
}

async function syncRoomFromServer(force = false) {
  if (!state.currentRoomCode) return null;
  const now = Date.now();
  if (!force && now - Number(state.lastPollTime || 0) < 650) return null;
  state.lastPollTime = now;

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);
    if (!response.ok) return null;
    applyRoomSync(data);
    if (data.status === "closed"   || data.phase === "closed") return { ...data, shouldHandleClosed: true };
    if (data.status === "finished" || data.phase === "done")   return { ...data, shouldShowLeaderboard: true };
    return data;
  } catch { return null; }
}

// ─── Game loop ────────────────────────────────────────────────────────────────

function stopGameLoops() {
  if (state.syncLoop)  { clearInterval(state.syncLoop);  state.syncLoop  = null; }
  if (state.lobbyPoll) { clearInterval(state.lobbyPoll); state.lobbyPoll = null; }
}

function resetQuestionLocalState(challengeIndex) {
  state.currentChallengeIndex       = challengeIndex;
  state.answeredCurrentChallenge    = false;
  state.submittingAnswer            = false;
  state.lastSubmitResult            = null;
  state.cachedLeaderboard           = null;
  state.selectedAnswer              = null;
  state.currentOrderSelection       = [];
}

async function ensureAnswerSubmitted(challengeIndex) {
  if (state.answeredCurrentChallenge || state.submittingAnswer) return;
  if (!state.currentPack?.challenges?.[challengeIndex]) return;
  await submitAnswerForIndex(challengeIndex, "__TIMEOUT__", 0, true);
}

function startSyncedLoop() {
  if (state.syncLoop) clearInterval(state.syncLoop);

  let trackedChallenge = -1;
  let trackedPhase     = "";

  state.syncLoop = setInterval(async () => {
    if (state.syncTickRunning) return;
    state.syncTickRunning = true;

    try {
      const synced = await syncRoomFromServer(false);

      if (synced?.shouldHandleClosed)    { await handleRoomClosed("The arena was closed by the host."); return; }
      if (synced?.shouldShowLeaderboard) { stopGameLoops(); await showLeaderboard(); return; }

      const arena = getTimedPhase();

      if (arena.phase === "done") { stopGameLoops(); await showLeaderboard(); return; }

      const phaseChanged     = arena.phase !== trackedPhase;
      const challengeChanged = arena.challengeIndex !== trackedChallenge;

      if (arena.phase === "question") {
        if (phaseChanged || challengeChanged) {
          trackedPhase     = "question";
          trackedChallenge = arena.challengeIndex;
          resetQuestionLocalState(arena.challengeIndex);
          saveSession();

          const progress = Math.round((arena.challengeIndex / state.currentPack.challenges.length) * 100);
          document.getElementById("progressText").textContent  = `${progress}%`;
          document.getElementById("progressBar").style.width   = `${progress}%`;
          document.getElementById("scoreText").textContent     = state.localScore;
          document.getElementById("challengeNumberText").textContent = arena.challengeIndex + 1;

          renderChallenge(submitCurrentAnswer);
        }
        state.timeLeft = arena.timeLeft;
        updateTimerUI();
        if (!state.answeredCurrentChallenge && arena.timeLeft <= 0) {
          await ensureAnswerSubmitted(arena.challengeIndex);
        }
      }

      if (arena.phase === "result") {
        if (!state.answeredCurrentChallenge) await ensureAnswerSubmitted(arena.challengeIndex);
        if (phaseChanged || challengeChanged) {
          trackedPhase = "result"; trackedChallenge = arena.challengeIndex;
          state.currentChallengeIndex = arena.challengeIndex;
          state.timeLeft              = arena.timeLeft;
          renderResultPhase(state.currentPack.challenges[arena.challengeIndex], state.lastSubmitResult);
        }
      }

      if (arena.phase === "leaderboard") {
        if (phaseChanged || challengeChanged) {
          trackedPhase = "leaderboard"; trackedChallenge = arena.challengeIndex;
          state.currentChallengeIndex = arena.challengeIndex;
          state.timeLeft              = arena.timeLeft;

          try {
            const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);
            if (response.ok) { syncClock(data.serverNow); state.cachedLeaderboard = data; }
            else if (data.error?.includes("closed")) { await handleRoomClosed("The arena was closed by the host."); return; }
          } catch {}

          const isLast = arena.challengeIndex >= state.currentPack.challenges.length - 1;
          renderMiniLeaderboard(state.cachedLeaderboard, state.currentPack, isLast);
        }

        const cd = document.getElementById("lbCountdown");
        if (cd) cd.textContent = `Next in ${arena.timeLeft}s`;
      }
    } finally {
      state.syncTickRunning = false;
    }
  }, 250);
}

// ─── Answer submission ────────────────────────────────────────────────────────

function hasValidAnswer(challenge) {
  if (state.selectedAnswer === "__TIMEOUT__") return true;
  if (["order_steps", "multiple_select", "matching"].includes(challenge.type)) {
    return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  }
  return state.selectedAnswer !== null && state.selectedAnswer !== "";
}

async function submitAnswerForIndex(challengeIndex, selectedAnswer, timeLeft, isTimeout = false) {
  if (state.submittingAnswer) return;
  state.submittingAnswer         = true;
  state.answeredCurrentChallenge = true;

  if (!isTimeout) {
    document.getElementById("submitAnswerBtn").disabled = true;
    renderLockedState();
  }

  try {
    const { response, data } = await api.submitAnswer(
      state.currentRoomCode, state.currentPlayerId, challengeIndex, selectedAnswer, timeLeft
    );

    if (!response.ok) {
      if (data.error?.includes("closed")) { await handleRoomClosed("The arena was closed by the host."); return; }
      throw new Error(data.error || "Could not submit answer.");
    }

    if (!data.alreadyAnswered) {
      state.localScore       = data.score;
      state.lastSubmitResult = data;
      document.getElementById("scoreText").textContent = state.localScore;
    }

    applyRoomSync(data);
    saveSession();

    if (data.status === "closed" || data.phase === "closed") { await handleRoomClosed("The arena was closed by the host."); return; }
    if (data.status === "finished" || data.phase === "done") { stopGameLoops(); await showLeaderboard(); }
  } catch (err) {
    console.error(err);
    if (!isTimeout) {
      state.answeredCurrentChallenge = false;
      document.getElementById("submitAnswerBtn").disabled = false;
      showToast(err.message || "Could not submit answer.", "danger");
    }
  } finally {
    state.submittingAnswer = false;
  }
}

async function submitCurrentAnswer() {
  const challenge = state.currentPack.challenges[state.currentChallengeIndex];
  if (challenge.type === "order_steps") state.selectedAnswer = [...state.currentOrderSelection];
  if (!hasValidAnswer(challenge)) return;
  if (state.answeredCurrentChallenge || state.submittingAnswer) return;
  await submitAnswerForIndex(state.currentChallengeIndex, state.selectedAnswer, state.timeLeft, false);
}

// ─── Arena action buttons ─────────────────────────────────────────────────────

function removeArenaActionButtons() { document.getElementById("efArenaActions")?.remove(); }

function mountArenaActionButtons(context) {
  removeArenaActionButtons();
  if (!state.currentRoomCode || !state.currentPlayerId) return;

  const wrapper = document.createElement("div");
  wrapper.id = "efArenaActions";
  Object.assign(wrapper.style, { position: "fixed", right: "22px", bottom: "22px", zIndex: "60",
    display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end",
    maxWidth: "calc(100vw - 44px)" });

  if (state.isHost && context === "lobby" && state.currentUser) {
    const invBtn = document.createElement("button");
    invBtn.type = "button"; invBtn.className = "btn btn-secondary"; invBtn.textContent = "Invite friends";
    invBtn.addEventListener("click", () => showInviteFriendsModal({ roomCode: state.currentRoomCode, currentUser: state.currentUser }));
    wrapper.appendChild(invBtn);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = state.isHost ? "btn" : "btn btn-secondary";

  if (state.isHost) {
    btn.textContent = context === "lobby" ? "Close arena" : "Close quiz";
    btn.addEventListener("click", closeCurrentArena);
  } else {
    btn.textContent = context === "lobby" ? "Leave lobby" : "Abandon quiz";
    btn.addEventListener("click", leaveCurrentArena);
  }

  wrapper.appendChild(btn);
  document.body.appendChild(wrapper);
}

// ─── Close / Leave ────────────────────────────────────────────────────────────

async function closeCurrentArena() {
  if (!state.currentRoomCode || !state.currentPlayerId) return;

  const ok = await showConfirm({
    title: "Close arena?",
    message: "This will close the arena for all players. The quiz will not be saved to history and no one's streak will increase.",
    confirmText: "Close arena", cancelText: "Cancel", danger: true
  });
  if (!ok) return;

  try {
    const { response, data } = await api.closeRoom(state.currentRoomCode, state.currentPlayerId);
    if (!response.ok) throw new Error(data.error || "Could not close arena.");
    stopGameLoops(); clearSession(); resetRoomState(); removeArenaActionButtons();
    showToast("The arena has been closed.", "success");
    nav.home();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not close arena.", "danger");
  }
}

async function leaveCurrentArena() {
  if (!state.currentRoomCode || !state.currentPlayerId) return;
  const isLobby = !state.currentPack;

  const ok = await showConfirm({
    title: isLobby ? "Leave lobby?" : "Abandon quiz?",
    message: isLobby ? "Leave the lobby?" : "Abandon the quiz? It will not count toward your streak or quiz total.",
    confirmText: isLobby ? "Leave lobby" : "Abandon quiz", cancelText: "Cancel", danger: !isLobby
  });
  if (!ok) return;

  try {
    const { response, data } = await api.leaveRoom(state.currentRoomCode, state.currentPlayerId);
    if (!response.ok) throw new Error(data.error || "Could not leave arena.");
    stopGameLoops(); clearSession(); resetRoomState(); removeArenaActionButtons();
    showToast(isLobby ? "You left the lobby." : "You abandoned the quiz.", "success");
    nav.home();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not leave arena.", "danger");
  }
}

async function handleRoomClosed(message = "The arena has been closed.") {
  stopGameLoops(); clearSession(); resetRoomState(); removeArenaActionButtons();
  await showNotice({ title: "Arena closed", message, variant: "info", buttonText: "OK" });
  nav.home();
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

async function showLobby() {
  showSection("lobbyScreen");

  document.getElementById("roomCodeText").textContent = state.currentRoomCode;

  const link = `${window.location.origin}/join?room=${state.currentRoomCode}`;
  document.getElementById("joinLinkText").textContent = link;

  if (typeof QRCode !== "undefined") {
    QRCode.toCanvas(document.getElementById("qrCanvas"), link, { width: 190, margin: 1 });
  }

  document.getElementById("startArenaBtn")?.classList.toggle("hidden", !state.isHost);
  document.getElementById("lobbyStatusText").textContent = state.isHost ? "Waiting for players." : "Waiting for host to start.";

  mountArenaActionButtons("lobby");
  await refreshRoomInfo();
}

async function refreshRoomInfo() {
  const { response, data } = await api.fetchRoom(state.currentRoomCode);
  if (!response.ok) { document.getElementById("lobbyStatusText").textContent = data.error || "Room not found."; return; }

  applyRoomSync(data);

  if (data.status === "closed" || data.phase === "closed") {
    await handleRoomClosed("The arena was closed by the host.");
    return;
  }

  document.getElementById("roomTitleText").textContent   = data.packTitle   || "Generated arena";
  document.getElementById("roomSummaryText").textContent = data.packSummary || "";

  renderPlayerList(data.players);
  renderConceptPills(data.concepts);
  mountArenaActionButtons("lobby");

  if (data.status === "started" && !state.currentPack) await loadPackAndStart();
  if (data.status === "finished") await showLeaderboard();
}

function startLobbyPolling() {
  if (state.lobbyPoll) clearInterval(state.lobbyPoll);
  state.lobbyPoll = setInterval(refreshRoomInfo, 800);
}

// ─── Pack load & start ────────────────────────────────────────────────────────

async function loadPackAndStart() {
  if (state.packLoading) return;
  state.packLoading = true;

  if (state.lobbyPoll) { clearInterval(state.lobbyPoll); state.lobbyPoll = null; }

  const { response, data } = await api.fetchPack(state.currentRoomCode);

  if (!response.ok) {
    if (data.error?.includes("closed")) { await handleRoomClosed("The arena was closed by the host."); return; }
    document.getElementById("lobbyStatusText").textContent = data.error || "Pack not available.";
    state.packLoading = false;
    return;
  }

  state.currentPack  = data.pack;
  state.questionTime = data.questionTime || QUESTION_TIME;
  state.localScore   = 0;

  applyRoomSync(data);
  saveSession();

  document.getElementById("playerNameText").textContent = state.currentPlayerName || "Player";
  showSection("challengeScreen");
  mountArenaActionButtons("challenge");
  startSyncedLoop();
  state.packLoading = false;
}

async function startArena() {
  document.getElementById("startArenaBtn").disabled = true;
  document.getElementById("lobbyStatusText").textContent = "Starting...";

  try {
    const { response, data } = await api.startRoom(state.currentRoomCode);
    if (!response.ok) throw new Error(data.error || "Could not start arena.");
    applyRoomSync(data);
    await loadPackAndStart();
  } catch (err) {
    console.error(err);
    document.getElementById("lobbyStatusText").textContent = err.message || "Could not start.";
    showToast(err.message || "Could not start.", "danger");
  } finally {
    document.getElementById("startArenaBtn").disabled = false;
  }
}

async function copyJoinLink() {
  const link = `${window.location.origin}/join?room=${state.currentRoomCode}`;
  try {
    await navigator.clipboard.writeText(link);
    document.getElementById("lobbyStatusText").textContent = "Link copied.";
    showToast("Link copied.", "success");
  } catch {
    document.getElementById("lobbyStatusText").textContent = link;
    showToast("Could not copy the link automatically.", "danger");
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

async function showLeaderboard() {
  stopGameLoops();
  removeArenaActionButtons();

  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

  if (!response.ok) {
    if (data.error?.includes("closed")) { await handleRoomClosed("The arena was closed by the host."); return; }
    showToast(data.error || "Could not load leaderboard.", "danger");
    return;
  }

  syncClock(data.serverNow);
  showSection("leaderboardScreen");
  renderPodium(data, state.currentPack);

  if (state.currentUser && state.isHost && state.currentPack) {
    saveGameSession({
      user: state.currentUser, profile: state.userProfile,
      pack: state.currentPack, roomCode: state.currentRoomCode,
      documentName: state.documentName, documentText: state.documentText,
      leaderboardData: data
    });
  }
}

// ─── Recovery lesson ─────────────────────────────────────────────────────────

async function generateRecoveryLesson() {
  const btn     = document.getElementById("generateLessonBtn");
  const lessonBox = document.getElementById("lessonBox");

  btn.disabled    = true;
  btn.textContent = "Generating...";
  lessonBox.innerHTML = "";

  try {
    const { response, data } = await api.generateLesson(state.currentRoomCode, state.currentPlayerId);
    if (!response.ok) throw new Error(data.error || "Could not generate lesson.");
    renderRecoveryLesson(data.lesson);
  } catch (err) {
    const p = document.createElement("p");
    p.className = "muted"; p.textContent = err.message || "Could not generate.";
    lessonBox.appendChild(p);
    showToast(err.message || "Could not generate lesson.", "danger");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Generate AI lesson";
  }
}

// ─── Session restore ──────────────────────────────────────────────────────────

async function restoreSession() {
  const raw = sessionStorage.getItem("ef_session");
  if (!raw) return false;

  let saved;
  try { saved = JSON.parse(raw); } catch { return false; }
  if (!saved.currentRoomCode || !saved.currentPlayerId) return false;

  Object.assign(state, {
    currentRoomCode:   saved.currentRoomCode,
    currentPlayerId:   saved.currentPlayerId,
    currentPlayerName: saved.currentPlayerName,
    isHost:            saved.isHost,
    localScore:        saved.localScore || 0,
    questionTime:      saved.questionTime || QUESTION_TIME,
    startedAt:         saved.startedAt,
    arenaEndsAt:       saved.arenaEndsAt,
    serverClockOffset: saved.serverClockOffset || 0,
    documentName:      saved.documentName || "",
    documentText:      saved.documentText || ""
  });

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);
    if (!response.ok) { clearSession(); resetRoomState(); return false; }

    applyRoomSync(data);

    if (data.status === "closed" || data.phase === "closed") {
      await handleRoomClosed("The arena has been closed.");
      return true;
    }
    if (data.status === "lobby") { await showLobby(); startLobbyPolling(); return true; }

    if (data.status === "started" || data.status === "finished") {
      const { response: pr, data: pd } = await api.fetchPack(state.currentRoomCode);
      if (!pr.ok) { clearSession(); resetRoomState(); return false; }

      state.currentPack  = pd.pack;
      state.questionTime = pd.questionTime || QUESTION_TIME;
      applyRoomSync(pd);

      if (data.status === "finished" || data.phase === "done") { await showLeaderboard(); }
      else {
        document.getElementById("playerNameText").textContent = state.currentPlayerName || "Player";
        showSection("challengeScreen");
        mountArenaActionButtons("challenge");
        startSyncedLoop();
      }
      return true;
    }
  } catch { clearSession(); resetRoomState(); }

  return false;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (auth) {
    state.currentUser  = auth.user;
    state.userProfile  = auth.profile;
  }

  // Try to restore existing session
  const restored = await restoreSession();
  if (restored) return;

  // Otherwise use room code from URL
  const roomCode = new URLSearchParams(window.location.search).get("room");
  if (!roomCode) { nav.home(); return; }

  // Session was set by home.js before redirecting here
  const sessionStr = sessionStorage.getItem("ef_session");
  if (!sessionStr) { nav.home(); return; }

  let saved;
  try { saved = JSON.parse(sessionStr); } catch { nav.home(); return; }

  Object.assign(state, {
    currentRoomCode:   saved.currentRoomCode,
    currentPlayerId:   saved.currentPlayerId,
    currentPlayerName: saved.currentPlayerName,
    isHost:            saved.isHost,
    localScore:        0,
    questionTime:      saved.questionTime || QUESTION_TIME,
    startedAt:         saved.startedAt,
    arenaEndsAt:       saved.arenaEndsAt,
    serverClockOffset: saved.serverClockOffset || 0,
    documentName:      saved.documentName || "",
    documentText:      saved.documentText || ""
  });

  await showLobby();
  startLobbyPolling();
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("startArenaBtn")?.addEventListener("click",     startArena);
document.getElementById("copyLinkBtn")?.addEventListener("click",       copyJoinLink);
document.getElementById("submitAnswerBtn")?.addEventListener("click",   submitCurrentAnswer);
document.getElementById("viewLeaderboardBtn")?.addEventListener("click", showLeaderboard);
document.getElementById("generateLessonBtn")?.addEventListener("click", generateRecoveryLesson);
document.getElementById("backHomeBtn")?.addEventListener("click", () => {
  clearSession(); resetRoomState(); nav.home();
});

init();
