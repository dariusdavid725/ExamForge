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
  renderLeaderboard,
  renderRecoveryLesson
} from "./renderer.js";

// ─── Timer ───────────────────────────────────────────────────────────────────

function startChallengeTimer() {
  clearInterval(state.timer);

  state.timeLeft = state.questionTime;
  updateTimerUI();

  state.timer = setInterval(() => {
    // Bug fix: clamp to 0 so the timer never displays negative
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    updateTimerUI();

    if (state.timeLeft <= 0) {
      clearInterval(state.timer);

      if (!dom.feedbackBox.classList.contains("hidden")) return;

      const challenge = state.currentPack.challenges[state.currentChallengeIndex];

      if (challenge.type === "order_steps") {
        state.selectedAnswer = [...state.currentOrderSelection];
      } else if (!state.selectedAnswer) {
        state.selectedAnswer = "__TIMEOUT__";
      }

      submitCurrentAnswer();
    }
  }, 1000);
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

  clearInterval(state.timer);
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
    dom.scoreText.textContent = state.localScore;

    const isLastChallenge =
      state.currentChallengeIndex >= state.currentPack.challenges.length - 1;

    renderAnswerFeedback(data, isLastChallenge);
  } catch (error) {
    console.error(error);
    dom.feedbackTitle.textContent = "Submission error";
    dom.explanationText.textContent = error.message || "Could not submit.";
    dom.feedbackBox.classList.remove("hidden");
  }
}

function nextChallenge() {
  state.currentChallengeIndex++;

  if (state.currentChallengeIndex >= state.currentPack.challenges.length) {
    dom.progressText.textContent = "100%";
    dom.progressBar.style.width = "100%";
    dom.viewLeaderboardBtn.classList.remove("hidden");
    showWaitingResults();
  } else {
    renderChallenge(submitCurrentAnswer);
    startChallengeTimer();
  }
}

// ─── Room lifecycle ───────────────────────────────────────────────────────────

async function loadPackAndStart() {
  // Bug fix: guard against concurrent calls from lobby polling + startArena
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
  state.arenaEndsAt = data.endsAt;
  state.questionTime = data.questionTime || 20;
  state.currentChallengeIndex = 0;
  state.localScore = 0;

  startArenaEndWatcher();
  dom.playerNameText.textContent = state.currentPlayerName || "Player";
  showScreen(dom.screens.challenge);
  renderChallenge(submitCurrentAnswer);
  startChallengeTimer();
}

function startArenaEndWatcher() {
  if (state.arenaEndWatcher) clearInterval(state.arenaEndWatcher);

  state.arenaEndWatcher = setInterval(() => {
    if (!state.arenaEndsAt) return;
    if (Date.now() >= state.arenaEndsAt) {
      // Bug fix: clear interval BEFORE calling showLeaderboard
      // to prevent multiple rapid calls while showLeaderboard awaits the fetch
      clearInterval(state.arenaEndWatcher);
      state.arenaEndWatcher = null;
      showLeaderboard();
    }
  }, 700);
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

function showWaitingResults() {
  showScreen(dom.screens.waiting);

  if (state.waitingResultsTimer) clearInterval(state.waitingResultsTimer);

  state.waitingResultsTimer = setInterval(async () => {
    try {
      const { response, data } = await api.fetchRoom(state.currentRoomCode);

      if (response.ok) {
        const allFinished =
          data.players.length > 0 && data.players.every(p => p.finished);

        if (data.endsAt) state.arenaEndsAt = data.endsAt;

        if (allFinished) {
          clearInterval(state.waitingResultsTimer);
          showLeaderboard();
          return;
        }
      }

      const secondsLeft = Math.max(0, Math.ceil((state.arenaEndsAt - Date.now()) / 1000));
      dom.waitingSecondsText.textContent = secondsLeft;

      if (secondsLeft <= 0) {
        clearInterval(state.waitingResultsTimer);
        showLeaderboard();
      }
    } catch (error) {
      console.error(error);
    }
  }, 500);
}

async function showLeaderboard() {
  clearInterval(state.timer);
  if (state.arenaEndWatcher) clearInterval(state.arenaEndWatcher);
  if (state.waitingResultsTimer) clearInterval(state.waitingResultsTimer);

  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

  if (!response.ok) {
    alert(data.error || "Could not load leaderboard.");
    return;
  }

  showScreen(dom.screens.leaderboard);
  renderLeaderboard(data, state.currentPack);
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

    // SSE stream — updates status text in real time as backend reports progress
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

  if (state.timer) clearInterval(state.timer);
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
dom.nextChallengeBtn.addEventListener("click", nextChallenge);
dom.viewLeaderboardBtn.addEventListener("click", showLeaderboard);
dom.generateLessonBtn.addEventListener("click", generateRecoveryLesson);

document.querySelectorAll(".mode-option").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-option").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    state.selectedGameMode = button.dataset.mode;
  });
});

// ─── URL room param detection ─────────────────────────────────────────────────

const roomParam = new URLSearchParams(window.location.search).get("room");

if (roomParam) {
  dom.joinCodeInput.value = roomParam.toUpperCase();
  dom.joinStatusText.textContent = "Room code detected. Enter your nickname to join.";
}
