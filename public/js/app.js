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
  renderPodium,
  renderRecoveryLesson
} from "./renderer.js";

const RESULTS_DURATION = 6; // seconds — must match backend RESULTS_DURATION_SECONDS

// ─── Session persistence ──────────────────────────────────────────────────────

function saveSession() {
  sessionStorage.setItem("ef_session", JSON.stringify({
    currentRoomCode: state.currentRoomCode,
    currentPlayerId: state.currentPlayerId,
    currentPlayerName: state.currentPlayerName,
    isHost: state.isHost,
    currentChallengeIndex: state.currentChallengeIndex,
    localScore: state.localScore,
    questionTime: state.questionTime,
    startedAt: state.startedAt,
    arenaEndsAt: state.arenaEndsAt
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
    currentRoomCode: saved.currentRoomCode,
    currentPlayerId: saved.currentPlayerId,
    currentPlayerName: saved.currentPlayerName,
    isHost: saved.isHost,
    currentChallengeIndex: saved.currentChallengeIndex || 0,
    localScore: saved.localScore || 0,
    questionTime: saved.questionTime || 20,
    startedAt: saved.startedAt,
    arenaEndsAt: saved.arenaEndsAt
  });

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);
    if (!response.ok) { clearSession(); return; }

    if (data.status === "lobby") {
      await showLobby();
      startLobbyPolling();
      return;
    }

    if (data.status === "started" || data.status === "finished") {
      const { response: packRes, data: packData } = await api.fetchPack(state.currentRoomCode);
      if (!packRes.ok) { clearSession(); return; }

      state.currentPack = packData.pack;
      state.questionTime = packData.questionTime || 20;
      if (packData.startedAt) state.startedAt = packData.startedAt;
      if (packData.endsAt) state.arenaEndsAt = packData.endsAt;

      if (data.status === "finished") {
        await showLeaderboard();
      } else {
        dom.playerNameText.textContent = state.currentPlayerName || "Player";
        showScreen(dom.screens.challenge);
        startSyncedLoop();
      }
    }
  } catch {
    clearSession();
  }
}

// ─── Synced game loop ─────────────────────────────────────────────────────────

function getArenaPhase() {
  if (!state.startedAt || !state.currentPack) return { phase: "waiting" };

  const elapsed = Date.now() - state.startedAt;
  const totalChallenges = state.currentPack.challenges.length;
  const cycleMs = (state.questionTime + RESULTS_DURATION) * 1000;
  const cycleIndex = Math.floor(elapsed / cycleMs);
  const timeInCycle = elapsed % cycleMs;

  if (cycleIndex >= totalChallenges) return { phase: "done" };

  if (timeInCycle < state.questionTime * 1000) {
    return {
      phase: "question",
      challengeIndex: cycleIndex,
      timeLeft: Math.max(0, Math.ceil((state.questionTime * 1000 - timeInCycle) / 1000))
    };
  }

  return {
    phase: "results",
    challengeIndex: cycleIndex,
    timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000))
  };
}

function startSyncedLoop() {
  if (state.syncLoop) clearInterval(state.syncLoop);

  let trackedChallenge = -1;
  let trackedPhase = "";

  state.syncLoop = setInterval(() => {
    const arena = getArenaPhase();

    if (arena.phase === "done") {
      clearInterval(state.syncLoop);
      state.syncLoop = null;
      showLeaderboard();
      return;
    }

    const phaseChanged = arena.phase !== trackedPhase;
    const challengeChanged = arena.challengeIndex !== trackedChallenge;

    // ── Question phase ──
    if (arena.phase === "question") {
      if (phaseChanged || challengeChanged) {
        trackedPhase = arena.phase;
        trackedChallenge = arena.challengeIndex;
        state.currentChallengeIndex = arena.challengeIndex;
        state.answeredCurrentChallenge = false;
        state.lastSubmitResult = null;
        state.localScore = state.localScore; // keep current score
        saveSession();
        renderChallenge(submitCurrentAnswer);

        // Update progress
        const progress = Math.round((arena.challengeIndex / state.currentPack.challenges.length) * 100);
        dom.progressText.textContent = `${progress}%`;
        dom.progressBar.style.width = `${progress}%`;
        dom.scoreText.textContent = state.localScore;
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

    // ── Results phase ──
    if (arena.phase === "results") {
      if (phaseChanged || challengeChanged) {
        trackedPhase = arena.phase;
        trackedChallenge = arena.challengeIndex;

        // If player never answered, show correct answer
        if (!state.answeredCurrentChallenge) {
          const challenge = state.currentPack.challenges[arena.challengeIndex];
          showTimeoutFeedback(challenge);
        }
      }

      const isLast = arena.challengeIndex >= state.currentPack.challenges.length - 1;
      dom.nextChallengeBtn.textContent = isLast
        ? `🏆 Leaderboard in ${arena.timeLeft}s`
        : `⏭ Next question in ${arena.timeLeft}s`;
      dom.nextChallengeBtn.disabled = true;
      dom.nextChallengeBtn.classList.remove("hidden");
      dom.submitAnswerBtn.classList.add("hidden");
      dom.feedbackBox.classList.remove("hidden");
    }
  }, 200);
}

function showTimeoutFeedback(challenge) {
  dom.feedbackTitle.textContent = "Time's up!";
  dom.feedbackTitle.style.color = "var(--red)";

  const correctDisplay = challenge.type === "order_steps"
    ? challenge.correctOrder.join(" → ")
    : challenge.correctAnswer;

  dom.correctAnswerText.textContent = `Correct answer: ${correctDisplay}`;
  dom.explanationText.textContent = challenge.explanation || "";
  dom.sourceSnippet.textContent = challenge.sourceSnippet || "No source snippet.";
  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.remove("hidden");
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

    state.localScore = data.score;
    state.lastSubmitResult = data;
    state.answeredCurrentChallenge = true;
    dom.scoreText.textContent = state.localScore;

    const isLastChallenge = state.currentChallengeIndex >= state.currentPack.challenges.length - 1;
    renderAnswerFeedback(data, isLastChallenge);

    // Synced loop controls the "next question" button text — hide the default btn
    dom.nextChallengeBtn.classList.add("hidden");
  } catch (error) {
    console.error(error);
    dom.feedbackTitle.textContent = "Submission error";
    dom.explanationText.textContent = error.message || "Could not submit.";
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

  state.currentPack = data.pack;
  state.startedAt = data.startedAt;
  state.arenaEndsAt = data.endsAt;
  state.questionTime = data.questionTime || 20;
  state.currentChallengeIndex = 0;
  state.localScore = 0;
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
  dom.lobbyStatusText.textContent = state.isHost
    ? "Waiting for players."
    : "Waiting for host to start.";

  await refreshRoomInfo();
}

async function refreshRoomInfo() {
  const { response, data } = await api.fetchRoom(state.currentRoomCode);

  if (!response.ok) {
    dom.lobbyStatusText.textContent = data.error || "Room not found.";
    return;
  }

  dom.roomTitleText.textContent = data.packTitle || data.quizTitle || "Generated arena";
  dom.roomSummaryText.textContent = data.packSummary || data.quizSummary || "";

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
  if (state.syncLoop) { clearInterval(state.syncLoop); state.syncLoop = null; }
  if (state.arenaEndWatcher) { clearInterval(state.arenaEndWatcher); state.arenaEndWatcher = null; }
  if (state.waitingResultsTimer) { clearInterval(state.waitingResultsTimer); state.waitingResultsTimer = null; }

  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

  if (!response.ok) {
    alert(data.error || "Could not load leaderboard.");
    return;
  }

  showScreen(dom.screens.leaderboard);
  renderPodium(data, state.currentPack);
}

// ─── Main actions ─────────────────────────────────────────────────────────────

async function createArena() {
  const file = dom.fileInput.files[0];
  const hostName = dom.hostNameInput.value.trim() || "Host";

  if (!file) {
    dom.hostStatusText.textContent = "Choose a document first.";
    return;
  }

  dom.createArenaBtn.disabled = true;
  dom.hostStatusText.textContent = "Starting...";

  try {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("gameMode", state.selectedGameMode);

    const packData = await api.generatePack(formData, (message) => {
      dom.hostStatusText.textContent = message;
    });

    dom.hostStatusText.textContent = "Creating arena...";
    const { response: roomRes, data: roomData } = await api.createRoom(packData.pack);
    if (!roomRes.ok) throw new Error(roomData.error || "Could not create room.");

    state.currentRoomCode = roomData.code;
    state.isHost = true;

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

  if (!code || !name) {
    dom.joinStatusText.textContent = "Enter room code and nickname.";
    return;
  }

  dom.joinArenaBtn.disabled = true;
  dom.joinStatusText.textContent = "Joining room...";

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
  state.currentPlayerId = data.playerId;
  state.currentPlayerName = name;
  saveSession();
}

async function startArena() {
  dom.startArenaBtn.disabled = true;
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
  const joinLink = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;
  try {
    await navigator.clipboard.writeText(joinLink);
    dom.lobbyStatusText.textContent = "Join link copied.";
  } catch {
    dom.lobbyStatusText.textContent = joinLink;
  }
}

async function generateRecoveryLesson() {
  dom.generateLessonBtn.disabled = true;
  dom.generateLessonBtn.textContent = "Generating AI lesson...";
  dom.lessonBox.innerHTML = "";

  try {
    const { response, data } = await api.generateLesson(
      state.currentRoomCode,
      state.currentPlayerId
    );

    if (!response.ok) throw new Error(data.error || "Could not generate lesson.");

    renderRecoveryLesson(data.lesson);
  } catch (error) {
    console.error(error);
    const errorBox = document.createElement("p");
    errorBox.className = "muted";
    errorBox.textContent = error.message || "Could not generate lesson.";
    dom.lessonBox.appendChild(errorBox);
  } finally {
    dom.generateLessonBtn.disabled = false;
    dom.generateLessonBtn.textContent = "Generate AI lesson";
  }
}

// ─── Browser history ──────────────────────────────────────────────────────────

history.replaceState({ screen: "home" }, "", window.location.href);

window.addEventListener("popstate", event => {
  const screenName = event.state?.screen || "home";
  const screen = dom.screens[screenName] || dom.screens.home;

  if (state.syncLoop) clearInterval(state.syncLoop);
  if (state.lobbyPoll) clearInterval(state.lobbyPoll);
  if (state.arenaEndWatcher) clearInterval(state.arenaEndWatcher);
  if (state.waitingResultsTimer) clearInterval(state.waitingResultsTimer);

  showScreen(screen, false);

  if (screenName === "lobby" && state.currentRoomCode) {
    startLobbyPolling();
    refreshRoomInfo();
  }

  if (screenName === "leaderboard" && state.currentRoomCode) {
    showLeaderboard();
  }
});

// ─── Event listeners ──────────────────────────────────────────────────────────

dom.dropZone.addEventListener("click", () => dom.fileInput.click());

dom.fileInput.addEventListener("change", () => {
  const file = dom.fileInput.files[0];
  if (file) {
    dom.fileName.textContent = file.name;
    dom.hostStatusText.textContent = "File selected. Ready to create AI arena.";
  }
});

dom.dropZone.addEventListener("dragover", event => event.preventDefault());

dom.dropZone.addEventListener("dragleave", () => {
  dom.dropZone.style.borderColor = "var(--text)";
});

dom.dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dom.dropZone.style.borderColor = "var(--text)";

  const file = event.dataTransfer.files[0];
  if (!file) return;

  dom.fileInput.files = event.dataTransfer.files;
  dom.fileName.textContent = file.name;
  dom.hostStatusText.textContent = "File selected. Ready to create AI arena.";
});

dom.createArenaBtn.addEventListener("click", createArena);
dom.joinArenaBtn.addEventListener("click", joinArena);
dom.startArenaBtn.addEventListener("click", startArena);
dom.copyLinkBtn.addEventListener("click", copyJoinLink);
dom.submitAnswerBtn.addEventListener("click", submitCurrentAnswer);
dom.viewLeaderboardBtn.addEventListener("click", showLeaderboard);
dom.generateLessonBtn.addEventListener("click", generateRecoveryLesson);

document.querySelectorAll(".mode-option").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-option").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    state.selectedGameMode = button.dataset.mode;
  });
});

// ─── URL room param ───────────────────────────────────────────────────────────

const roomParam = new URLSearchParams(window.location.search).get("room");
if (roomParam) {
  dom.joinCodeInput.value = roomParam.toUpperCase();
  dom.joinStatusText.textContent = "Room code detected. Enter your nickname to join.";
}

// ─── Restore session on page load ────────────────────────────────────────────

restoreSession();
