import * as dom from "./dom.js";
import { state } from "./state.js";
import * as api from "./api.js";
import { getSession, login, register } from "./auth.js";
import { getSupabase, getProfile } from "./supabaseClient.js";
import {
  saveGameSession,
  renderDashboard,
  loadNotificationCount
} from "./dashboard.js";
import {
  showScreen,
  updateTimerUI,
  renderChallenge,
  renderPlayerList,
  renderConceptPills,
  renderLockedState,
  renderResultPhase,
  renderMiniLeaderboard,
  renderPodium,
  renderRecoveryLesson
} from "./renderer.js";

const QUESTION_TIME = 20;
const RESULT_DURATION = 3;
const LB_DURATION = 5;

// ─── Auth initialization ──────────────────────────────────────────────────────

async function initApp() {
  showScreen(dom.screens.auth, false);
  setupAuthListeners();

  try {
    const session = await getSession();

    if (!session) return;

    state.currentUser = session.user;
    state.userProfile = await getProfile(session.user.id);

    setupHeader();
    await showDashboard();
  } catch (err) {
    console.error("initApp error:", err);
  }
}

function setupHeader() {
  if (!state.currentUser) return;

  const profile = state.userProfile;
  const letter = (profile?.username || state.currentUser.email || "U")[0].toUpperCase();
  const color = profile?.avatar_color || "#4f46e5";
  const streak = profile?.streak_count || 0;

  if (dom.headerUserArea) {
    dom.headerUserArea.innerHTML = `
      <div style="
        width:34px;
        height:34px;
        border-radius:999px;
        background:${color};
        color:white;
        display:grid;
        place-items:center;
        font-weight:900;
        border:3px solid var(--text);
      ">
        ${letter}
      </div>
      <strong>${profile?.username || ""}</strong>
    `;

    dom.headerUserArea.style.display = "flex";
    dom.headerUserArea.addEventListener("click", () => showDashboard());
  }

  if (dom.headerStreak) {
    dom.headerStreak.textContent = `${streak}`;
    dom.headerStreak.style.display = streak > 0 ? "" : "none";
  }

  loadNotificationCount(state.currentUser.id).then(count => {
    if (dom.bellBadge) {
      dom.bellBadge.textContent = count;
      dom.bellBadge.style.display = count > 0 ? "" : "none";
    }
  });
}

async function showDashboard() {
  if (!state.currentUser) {
    showScreen(dom.screens.auth, false);
    return;
  }

  showScreen(dom.screens.dashboard, false);

  if (!dom.dashboardContent) return;

  dom.dashboardContent.innerHTML = `
    <div class="card">
      <p class="muted">Loading dashboard...</p>
    </div>
  `;

  try {
    await renderDashboard(
      dom.dashboardContent,
      state.currentUser,
      state.userProfile,
      {
        onCreateArena: () => showScreen(dom.screens.home),
        onJoinArena: () => {
          showScreen(dom.screens.home);
          setTimeout(() => dom.joinCodeInput?.focus(), 100);
        },
        onHistory: () => showHistoryScreen()
      }
    );
  } catch (err) {
    console.error("Dashboard error:", err);

    dom.dashboardContent.innerHTML = `
      <div class="card">
        <h2>Welcome!</h2>
        <p class="muted" style="margin-top:10px;">Logged in as ${state.currentUser.email}</p>
        <div class="row" style="margin-top:18px;">
          <button id="toHomeBtn" class="btn">⚡ Create Arena</button>
          <button id="toJoinBtn" class="btn btn-secondary">Join Arena</button>
        </div>
      </div>
    `;

    document.getElementById("toHomeBtn")?.addEventListener("click", () => {
      showScreen(dom.screens.home);
    });

    document.getElementById("toJoinBtn")?.addEventListener("click", () => {
      showScreen(dom.screens.home);
    });
  }
}

async function showHistoryScreen() {
  showScreen(dom.screens.history, false);

  const supabase = await getSupabase();

  const { data: sessions } = await supabase
    .from("game_sessions")
    .select("*, game_results(*)")
    .eq("host_id", state.currentUser.id)
    .order("played_at", { ascending: false });

  const container = document.getElementById("historyContent");

  if (!container) return;

  container.innerHTML =
    sessions && sessions.length
      ? sessions
          .map(session => {
            return `
              <div class="card">
                <h3>${session.title}</h3>
                <p class="muted" style="margin-top:8px;">
                  ${session.category} · ${session.player_count} players ·
                  ${new Date(session.played_at).toLocaleDateString()}
                </p>
              </div>
            `;
          })
          .join("")
      : `
        <div class="card">
          <p class="muted">No quizzes yet.</p>
        </div>
      `;
}

// ─── Auth listeners ───────────────────────────────────────────────────────────

function setupAuthListeners() {
  dom.authTabLogin?.addEventListener("click", () => {
    dom.authTabLogin.classList.add("auth-tab-active");
    dom.authTabRegister?.classList.remove("auth-tab-active");
    dom.loginForm?.classList.remove("hidden");
    dom.registerForm?.classList.add("hidden");

    if (dom.loginError) {
      dom.loginError.textContent = "";
    }
  });

  dom.authTabRegister?.addEventListener("click", () => {
    dom.authTabRegister.classList.add("auth-tab-active");
    dom.authTabLogin?.classList.remove("auth-tab-active");
    dom.registerForm?.classList.remove("hidden");
    dom.loginForm?.classList.add("hidden");

    if (dom.registerError) {
      dom.registerError.textContent = "";
    }
  });

  dom.loginBtn?.addEventListener("click", handleLogin);

  dom.loginPassword?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      handleLogin();
    }
  });

  dom.registerBtn?.addEventListener("click", handleRegister);

  dom.registerPassword?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      handleRegister();
    }
  });
}

async function handleLogin() {
  const email = dom.loginEmail?.value?.trim() || "";
  const password = dom.loginPassword?.value || "";

  if (!email || !password) {
    if (dom.loginError) {
      dom.loginError.textContent = "Enter your email and password.";
    }

    return;
  }

  if (dom.loginError) {
    dom.loginError.textContent = "";
  }

  if (dom.loginBtn) {
    dom.loginBtn.textContent = "Logging in...";
    dom.loginBtn.disabled = true;
  }

  try {
    const user = await login(email, password);

    state.currentUser = user;
    state.userProfile = await getProfile(user.id);

    setupHeader();
    await showDashboard();
  } catch (error) {
    if (dom.loginError) {
      dom.loginError.textContent = error.message || "Login failed.";
    }
  } finally {
    if (dom.loginBtn) {
      dom.loginBtn.disabled = false;
      dom.loginBtn.textContent = "Login";
    }
  }
}

async function handleRegister() {
  const username = dom.registerUsername?.value?.trim() || "";
  const email = dom.registerEmail?.value?.trim() || "";
  const password = dom.registerPassword?.value || "";

  if (!username || !email || !password) {
    if (dom.registerError) {
      dom.registerError.textContent = "All fields are required.";
    }

    return;
  }

  if (dom.registerError) {
    dom.registerError.textContent = "";
  }

  if (dom.registerBtn) {
    dom.registerBtn.textContent = "Creating account...";
    dom.registerBtn.disabled = true;
  }

  try {
    const user = await register(email, password, username);

    state.currentUser = user;
    state.userProfile = await getProfile(user.id);

    if (!state.userProfile) {
      await new Promise(resolve => setTimeout(resolve, 800));
      state.userProfile = await getProfile(user.id);
    }

    setupHeader();
    await showDashboard();
  } catch (error) {
    if (dom.registerError) {
      dom.registerError.textContent = error.message || "Registration failed.";
    }
  } finally {
    if (dom.registerBtn) {
      dom.registerBtn.disabled = false;
      dom.registerBtn.textContent = "Create account";
    }
  }
}

// ─── Session persistence ──────────────────────────────────────────────────────

function saveSession() {
  sessionStorage.setItem(
    "ef_session",
    JSON.stringify({
      currentRoomCode: state.currentRoomCode,
      currentPlayerId: state.currentPlayerId,
      currentPlayerName: state.currentPlayerName,
      isHost: state.isHost,
      localScore: state.localScore,
      questionTime: state.questionTime,
      startedAt: state.startedAt,
      arenaEndsAt: state.arenaEndsAt
    })
  );
}

function clearSession() {
  sessionStorage.removeItem("ef_session");
}

async function restoreSession() {
  const raw = sessionStorage.getItem("ef_session");

  if (!raw) return;

  let saved;

  try {
    saved = JSON.parse(raw);
  } catch {
    return;
  }

  if (!saved.currentRoomCode || !saved.currentPlayerId) return;

  Object.assign(state, {
    currentRoomCode: saved.currentRoomCode,
    currentPlayerId: saved.currentPlayerId,
    currentPlayerName: saved.currentPlayerName,
    isHost: saved.isHost,
    localScore: saved.localScore || 0,
    questionTime: saved.questionTime || 20,
    startedAt: saved.startedAt,
    arenaEndsAt: saved.arenaEndsAt
  });

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);

    if (!response.ok) {
      clearSession();
      return;
    }

    state.playerCount = data.players?.length || 0;

    if (data.startedAt) {
      state.startedAt = data.startedAt;
    }

    if (data.endsAt) {
      state.arenaEndsAt = data.endsAt;
    }

    if (data.status === "lobby") {
      await showLobby();
      startLobbyPolling();
      return;
    }

    if (data.status === "started" || data.status === "finished") {
      const { response: packResponse, data: packData } = await api.fetchPack(
        state.currentRoomCode
      );

      if (!packResponse.ok) {
        clearSession();
        return;
      }

      state.currentPack = packData.pack;
      state.questionTime = packData.questionTime || 20;

      if (packData.startedAt) {
        state.startedAt = packData.startedAt;
      }

      if (packData.endsAt) {
        state.arenaEndsAt = packData.endsAt;
      }

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

function getTimedPhase() {
  if (!state.startedAt || !state.currentPack) {
    return {
      phase: "waiting"
    };
  }

  const questionTime = state.questionTime || QUESTION_TIME;
  const elapsed = Date.now() - Number(state.startedAt);
  const total = state.currentPack.challenges.length;
  const cycleMs = (questionTime + RESULT_DURATION + LB_DURATION) * 1000;
  const cycleIndex = Math.floor(elapsed / cycleMs);
  const timeInCycle = elapsed % cycleMs;

  if (cycleIndex >= total) {
    return {
      phase: "done"
    };
  }

  if (timeInCycle < questionTime * 1000) {
    return {
      phase: "question",
      challengeIndex: cycleIndex,
      timeLeft: Math.max(0, Math.ceil((questionTime * 1000 - timeInCycle) / 1000))
    };
  }

  if (timeInCycle < (questionTime + RESULT_DURATION) * 1000) {
    return {
      phase: "result",
      challengeIndex: cycleIndex,
      timeLeft: Math.max(
        0,
        Math.ceil(((questionTime + RESULT_DURATION) * 1000 - timeInCycle) / 1000)
      )
    };
  }

  return {
    phase: "leaderboard",
    challengeIndex: cycleIndex,
    timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000))
  };
}

function getArenaPhase() {
  const timed = getTimedPhase();

  if (timed.phase === "question" && state.earlyResult) {
    return {
      ...timed,
      phase: "result",
      timeLeft: RESULT_DURATION
    };
  }

  if (timed.phase === "question" && state.currentChallengeIndex !== timed.challengeIndex) {
    state.earlyResult = false;
  }

  return timed;
}

function updateManualNextButton(arena) {
  if (!dom.nextChallengeBtn) return;

  const isSolo = Number(state.playerCount || 0) === 1;

  const canShow =
    isSolo &&
    (arena.phase === "result" || arena.phase === "leaderboard");

  dom.nextChallengeBtn.classList.toggle("hidden", !canShow);

  if (!canShow) return;

  const isLast =
    arena.challengeIndex >= state.currentPack.challenges.length - 1;

  dom.nextChallengeBtn.textContent = isLast
    ? "Finish quiz"
    : "Next question";
}

async function goNextManual() {
  if (!state.currentRoomCode || !state.currentPlayerId) return;

  if (!dom.nextChallengeBtn) return;

  dom.nextChallengeBtn.disabled = true;
  dom.nextChallengeBtn.textContent = "Loading...";

  try {
    const { response, data } = await api.nextRoom(
      state.currentRoomCode,
      state.currentPlayerId
    );

    if (!response.ok) {
      throw new Error(data.error || "Could not go next.");
    }

    if (data.finished) {
      await showLeaderboard();
      return;
    }

    state.startedAt = data.startedAt;
    state.arenaEndsAt = data.endsAt;
    state.currentChallengeIndex = data.currentChallengeIndex;
    state.earlyResult = false;
    state.cachedLeaderboard = null;
    state.answeredCurrentChallenge = false;
    state.lastSubmitResult = null;

    saveSession();
  } catch (error) {
    console.error(error);
    dom.nextChallengeBtn.textContent = error.message || "Error";
  } finally {
    dom.nextChallengeBtn.disabled = false;
  }
}

function startSyncedLoop() {
  if (state.syncLoop) {
    clearInterval(state.syncLoop);
  }

  let trackedChallenge = -1;
  let trackedPhase = "";

  state.syncLoop = setInterval(async () => {
    const arena = getArenaPhase();

    if (arena.phase === "done") {
      clearInterval(state.syncLoop);
      state.syncLoop = null;
      await showLeaderboard();
      return;
    }

    const phaseChanged = arena.phase !== trackedPhase;
    const challengeChanged = arena.challengeIndex !== trackedChallenge;

    if (arena.phase === "question") {
      if (phaseChanged || challengeChanged) {
        trackedPhase = "question";
        trackedChallenge = arena.challengeIndex;

        state.currentChallengeIndex = arena.challengeIndex;
        state.answeredCurrentChallenge = false;
        state.lastSubmitResult = null;
        state.cachedLeaderboard = null;
        state.earlyResult = false;
        state.lastPollTime = 0;

        saveSession();

        const progress = Math.round(
          (arena.challengeIndex / state.currentPack.challenges.length) * 100
        );

        dom.progressText.textContent = `${progress}%`;
        dom.progressBar.style.width = `${progress}%`;
        dom.scoreText.textContent = state.localScore;
        dom.challengeNumberText.textContent = arena.challengeIndex + 1;

        renderChallenge(submitCurrentAnswer);
      }

      state.timeLeft = arena.timeLeft;
      updateTimerUI();
      updateManualNextButton(arena);

      if (!state.answeredCurrentChallenge && arena.timeLeft <= 0) {
        state.answeredCurrentChallenge = true;

        const challenge = state.currentPack.challenges[arena.challengeIndex];

        if (challenge.type === "order_steps") {
          state.selectedAnswer = [...state.currentOrderSelection];
        } else {
          state.selectedAnswer = state.selectedAnswer || "__TIMEOUT__";
        }

        submitCurrentAnswer();
      } else if (state.answeredCurrentChallenge) {
        const now = Date.now();

        if (now - state.lastPollTime > 900) {
          state.lastPollTime = now;

          try {
            const { response, data } = await api.fetchRoom(state.currentRoomCode);

            if (response.ok) {
              state.playerCount = data.players?.length || state.playerCount || 0;

              if (data.startedAt) {
                state.startedAt = data.startedAt;
              }

              if (data.endsAt) {
                state.arenaEndsAt = data.endsAt;
              }

              if (data.status === "finished") {
                clearInterval(state.syncLoop);
                state.syncLoop = null;
                await showLeaderboard();
                return;
              }

              if (data.allAnsweredCurrentQuestion) {
                state.earlyResult = true;
              }
            }
          } catch {
            // ignore polling errors
          }
        }
      }
    }

    if (arena.phase === "result") {
      if (phaseChanged || challengeChanged || (state.earlyResult && trackedPhase !== "result")) {
        trackedPhase = "result";
        trackedChallenge = arena.challengeIndex;

        renderResultPhase(
          state.currentPack.challenges[arena.challengeIndex],
          state.lastSubmitResult
        );

        updateManualNextButton(arena);
      }
    }

    if (arena.phase === "leaderboard") {
      if (phaseChanged || challengeChanged) {
        trackedPhase = "leaderboard";
        trackedChallenge = arena.challengeIndex;
        state.earlyResult = false;

        if (!state.cachedLeaderboard) {
          try {
            const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

            if (response.ok) {
              state.cachedLeaderboard = data;
            }
          } catch {
            // ignore
          }
        }

        const isLast =
          arena.challengeIndex >= state.currentPack.challenges.length - 1;

        renderMiniLeaderboard(state.cachedLeaderboard, state.currentPack, isLast);
        updateManualNextButton(arena);
      }

      const countdown = document.getElementById("lbCountdown");

      if (countdown) {
        countdown.textContent = `Next in ${arena.timeLeft}s`;
      }
    }
  }, 200);
}

// ─── Answer submission ────────────────────────────────────────────────────────

function hasValidAnswer(challenge) {
  if (state.selectedAnswer === "__TIMEOUT__") {
    return true;
  }

  if (challenge.type === "order_steps") {
    return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  }

  if (challenge.type === "multiple_select") {
    return Array.isArray(state.selectedAnswer) && state.selectedAnswer.length > 0;
  }

  if (challenge.type === "matching") {
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

  renderLockedState();

  try {
    const { response, data } = await api.submitAnswer(
      state.currentRoomCode,
      state.currentPlayerId,
      state.currentChallengeIndex,
      state.selectedAnswer,
      state.timeLeft
    );

    if (!response.ok) {
      throw new Error(data.error || "Could not submit answer.");
    }

    state.localScore = data.score;
    state.lastSubmitResult = data;

    if (data.startedAt) {
      state.startedAt = data.startedAt;
    }

    if (data.endsAt) {
      state.arenaEndsAt = data.endsAt;
    }

    dom.scoreText.textContent = state.localScore;
  } catch (error) {
    state.answeredCurrentChallenge = false;
    dom.submitAnswerBtn.disabled = false;
    console.error(error);
  }
}

// ─── Room lifecycle ───────────────────────────────────────────────────────────

async function loadPackAndStart() {
  if (state.packLoading) return;

  state.packLoading = true;

  if (state.lobbyPoll) {
    clearInterval(state.lobbyPoll);
  }

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

  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;

  dom.joinLinkText.textContent = link;

  QRCode.toCanvas(dom.qrCanvas, link, {
    width: 190,
    margin: 1
  });

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

  state.playerCount = data.players?.length || 0;

  if (data.startedAt) {
    state.startedAt = data.startedAt;
  }

  if (data.endsAt) {
    state.arenaEndsAt = data.endsAt;
  }

  dom.roomTitleText.textContent = data.packTitle || "Generated arena";
  dom.roomSummaryText.textContent = data.packSummary || "";

  renderPlayerList(data.players);
  renderConceptPills(data.concepts);

  if (data.status === "started" && !state.currentPack) {
    await loadPackAndStart();
  }
}

function startLobbyPolling() {
  if (state.lobbyPoll) {
    clearInterval(state.lobbyPoll);
  }

  state.lobbyPoll = setInterval(refreshRoomInfo, 1200);
}

async function showLeaderboard() {
  if (state.syncLoop) {
    clearInterval(state.syncLoop);
    state.syncLoop = null;
  }

  if (state.arenaEndWatcher) {
    clearInterval(state.arenaEndWatcher);
    state.arenaEndWatcher = null;
  }

  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

  if (!response.ok) {
    alert(data.error || "Could not load leaderboard.");
    return;
  }

  showScreen(dom.screens.leaderboard);
  renderPodium(data, state.currentPack);

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
  if (!state.currentUser) {
    showScreen(dom.screens.auth);
    return;
  }

  const file = dom.fileInput.files[0];
  const hostName =
    dom.hostNameInput.value.trim() ||
    state.userProfile?.username ||
    "Host";

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

    const packData = await api.generatePack(formData, message => {
      dom.hostStatusText.textContent = message;
    });

    state.documentName = file.name;
    state.documentText = packData.documentText || "";

    if (packData.documentText && packData.documentText.length > 200) {
      fetch("/api/conspect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: packData.documentText
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.conspect && state.currentPack) {
            state.currentPack.conspect = data.conspect;
          }
        })
        .catch(() => {});
    }

    dom.hostStatusText.textContent = "Creating arena...";

    const { response: roomResponse, data: roomData } = await api.createRoom(
      packData.pack
    );

    if (!roomResponse.ok) {
      throw new Error(roomData.error || "Could not create room.");
    }

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
  const name =
    dom.joinNameInput.value.trim() ||
    state.userProfile?.username ||
    "";

  if (!code || !name) {
    dom.joinStatusText.textContent = "Enter room code and nickname.";
    return;
  }

  dom.joinArenaBtn.disabled = true;
  dom.joinStatusText.textContent = "Joining...";

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

  if (!response.ok) {
    throw new Error(data.error || "Could not join room.");
  }

  state.currentPlayerId = data.playerId;
  state.currentPlayerName = name;

  saveSession();
}

async function startArena() {
  dom.startArenaBtn.disabled = true;
  dom.lobbyStatusText.textContent = "Starting...";

  try {
    const { response, data } = await api.startRoom(state.currentRoomCode);

    if (!response.ok) {
      throw new Error(data.error || "Could not start arena.");
    }

    state.startedAt = data.startedAt;
    state.arenaEndsAt = data.endsAt;
    state.questionTime = data.questionTime || 20;

    await loadPackAndStart();
  } catch (error) {
    console.error(error);
    dom.lobbyStatusText.textContent = error.message || "Could not start.";
  } finally {
    dom.startArenaBtn.disabled = false;
  }
}

async function copyJoinLink() {
  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;

  try {
    await navigator.clipboard.writeText(link);
    dom.lobbyStatusText.textContent = "Link copied.";
  } catch {
    dom.lobbyStatusText.textContent = link;
  }
}

async function generateRecoveryLesson() {
  dom.generateLessonBtn.disabled = true;
  dom.generateLessonBtn.textContent = "Generating...";
  dom.lessonBox.innerHTML = "";

  try {
    const { response, data } = await api.generateLesson(
      state.currentRoomCode,
      state.currentPlayerId
    );

    if (!response.ok) {
      throw new Error(data.error || "Could not generate lesson.");
    }

    renderRecoveryLesson(data.lesson);
  } catch (error) {
    const paragraph = document.createElement("p");

    paragraph.className = "muted";
    paragraph.textContent = error.message || "Could not generate.";

    dom.lessonBox.appendChild(paragraph);
  } finally {
    dom.generateLessonBtn.disabled = false;
    dom.generateLessonBtn.textContent = "Generate AI lesson";
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

history.replaceState({ screen: "home" }, "", window.location.href);

window.addEventListener("popstate", event => {
  const name = event.state?.screen || "home";
  const screen = dom.screens[name] || dom.screens.home;

  if (state.syncLoop) {
    clearInterval(state.syncLoop);
  }

  if (state.lobbyPoll) {
    clearInterval(state.lobbyPoll);
  }

  showScreen(screen, false);

  if (name === "lobby" && state.currentRoomCode) {
    startLobbyPolling();
    refreshRoomInfo();
  }

  if (name === "leaderboard" && state.currentRoomCode) {
    showLeaderboard();
  }
});

// ─── Event listeners ──────────────────────────────────────────────────────────

dom.dropZone?.addEventListener("click", () => {
  dom.fileInput.click();
});

dom.dropZone?.addEventListener("dragover", event => {
  event.preventDefault();
});

dom.dropZone?.addEventListener("dragleave", () => {
  if (dom.dropZone) {
    dom.dropZone.style.borderColor = "var(--text)";
  }
});

dom.dropZone?.addEventListener("drop", event => {
  event.preventDefault();

  if (dom.dropZone) {
    dom.dropZone.style.borderColor = "var(--text)";
  }

  const file = event.dataTransfer.files[0];

  if (!file) return;

  dom.fileInput.files = event.dataTransfer.files;

  if (dom.fileName) {
    dom.fileName.textContent = file.name;
  }

  if (dom.hostStatusText) {
    dom.hostStatusText.textContent = "File selected.";
  }
});

dom.fileInput?.addEventListener("change", () => {
  const file = dom.fileInput.files[0];

  if (file) {
    if (dom.fileName) {
      dom.fileName.textContent = file.name;
    }

    if (dom.hostStatusText) {
      dom.hostStatusText.textContent = "File selected.";
    }
  }
});

dom.createArenaBtn?.addEventListener("click", createArena);
dom.joinArenaBtn?.addEventListener("click", joinArena);
dom.startArenaBtn?.addEventListener("click", startArena);
dom.copyLinkBtn?.addEventListener("click", copyJoinLink);
dom.submitAnswerBtn?.addEventListener("click", submitCurrentAnswer);
dom.nextChallengeBtn?.addEventListener("click", goNextManual);
dom.viewLeaderboardBtn?.addEventListener("click", showLeaderboard);
dom.generateLessonBtn?.addEventListener("click", generateRecoveryLesson);

document.querySelectorAll(".mode-option").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-option").forEach(item => {
      item.classList.remove("selected");
    });

    button.classList.add("selected");
    state.selectedGameMode = button.dataset.mode;
  });
});

document.getElementById("backToDashboard")?.addEventListener("click", () => {
  showDashboard();
});

document.getElementById("backToDashboardFromHistory")?.addEventListener("click", () => {
  showDashboard();
});

const roomParam = new URLSearchParams(window.location.search).get("room");

if (roomParam && dom.joinCodeInput) {
  dom.joinCodeInput.value = roomParam.toUpperCase();

  if (dom.joinStatusText) {
    dom.joinStatusText.textContent = "Room code detected. Enter your nickname to join.";
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

initApp().then(() => restoreSession());