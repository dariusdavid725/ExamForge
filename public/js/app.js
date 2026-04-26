import * as dom from "./dom.js";
import { state } from "./state.js";
import * as api from "./api.js";
import { installThemeToggle } from "./theme.js";
import { getSession, login, register } from "./auth.js";
import { getProfile } from "./supabaseClient.js";
import {
  showInviteFriendsModal,
  renderRoomInvitesCard
} from "./roomInvites.js";
import {
  saveGameSession,
  renderDashboard,
  renderHistoryPage,
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

import {
  installFeedback,
  showToast,
  showConfirm,
  showNotice,
  showLoadingOverlay,
  updateLoadingOverlay,
  hideLoadingOverlay
} from "./uiFeedback.js";

const QUESTION_TIME = 20;
const RESULT_DURATION = 3;
const LB_DURATION = 5;

// ─── Auth initialization ──────────────────────────────────────────────────────

async function initApp() {
  installFeedback();
  installThemeToggle();
  polishStaticLabels();
  setupAuthListeners();

  showScreen(dom.screens.home, false);
  setupGuestHeader();

  try {
    const session = await getSession();

    if (!session) {
      return;
    }

    state.currentUser = session.user;
    state.userProfile = await getProfile(session.user.id);

    setupHeader();
  } catch (err) {
    console.error("initApp error:", err);
  }
}

function polishStaticLabels() {
  const dashboardButton = document.getElementById("backToDashboard");

  if (dashboardButton) {
    dashboardButton.textContent = "Dashboard";
  }

  const historyDashboardButton = document.getElementById("backToDashboardFromHistory");

  if (historyDashboardButton) {
    historyDashboardButton.textContent = "Dashboard";
  }
}

function setupGuestHeader() {
  if (state.currentUser) return;

  if (dom.headerUserArea) {
    dom.headerUserArea.innerHTML = `
      <div style="
        width:34px;
        height:34px;
        border-radius:999px;
        background:#111;
        color:white;
        display:grid;
        place-items:center;
        font-weight:900;
        border:3px solid var(--text);
      ">
        G
      </div>
      <strong>Guest</strong>
    `;

    dom.headerUserArea.style.display = "flex";
    dom.headerUserArea.onclick = () => showDashboard();
  }

  if (dom.headerStreak) {
    dom.headerStreak.style.display = "none";
  }

  if (dom.bellBadge) {
    dom.bellBadge.style.display = "none";
  }
}

function setupHeader() {
  if (!state.currentUser) {
    setupGuestHeader();
    return;
  }

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
    dom.headerUserArea.onclick = () => showDashboard();
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
  stopGameLoops();
  removeArenaActionButtons();

  if (!state.currentUser) {
    showScreen(dom.screens.auth, false);
    showToast("Intră în cont ca să vezi dashboard-ul, istoricul și prietenii.", "info");
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
        onCreateArena: () => {
          removeArenaActionButtons();
          showScreen(dom.screens.home);
        },
        onJoinArena: () => {
          removeArenaActionButtons();
          showScreen(dom.screens.home);
          setTimeout(() => dom.joinCodeInput?.focus(), 100);
        },
        onHistory: () => showHistoryScreen()
      }
    );

    await renderRoomInvitesCard(
      dom.dashboardContent,
      state.currentUser,
      async invite => {
        const name =
          state.userProfile?.username ||
          state.currentUser?.email?.split("@")[0] ||
          "Player";

        state.isHost = false;

        await joinRoomWithName(invite.room_code, name);
        await api.respondRoomInvite(invite.id, "accepted");

        state.currentRoomCode = invite.room_code;

        await showLobby();
        startLobbyPolling();
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
  stopGameLoops();
  removeArenaActionButtons();

  if (!state.currentUser) {
    showScreen(dom.screens.auth, false);
    showToast("Intră în cont ca să vezi istoricul quizurilor.", "info");
    return;
  }

  showScreen(dom.screens.history, false);

  const container = document.getElementById("historyContent");

  if (!container) return;

  await renderHistoryPage(container, state.currentUser);
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
    showToast("Ai intrat în cont.", "success");
    await showDashboard();
  } catch (error) {
    if (dom.loginError) {
      dom.loginError.textContent = error.message || "Login failed.";
    }

    showToast(error.message || "Login failed.", "danger");
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
    showToast("Cont creat cu succes.", "success");
    await showDashboard();
  } catch (error) {
    if (dom.registerError) {
      dom.registerError.textContent = error.message || "Registration failed.";
    }

    showToast(error.message || "Registration failed.", "danger");
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
      arenaEndsAt: state.arenaEndsAt,
      serverClockOffset: state.serverClockOffset || 0
    })
  );
}

function clearSession() {
  sessionStorage.removeItem("ef_session");
}

function resetRoomState() {
  state.currentRoomCode = null;
  state.currentPlayerId = null;
  state.currentPlayerName = null;
  state.isHost = false;
  state.localScore = 0;
  state.questionTime = QUESTION_TIME;
  state.startedAt = null;
  state.arenaEndsAt = null;
  state.currentPack = null;
  state.currentChallengeIndex = 0;
  state.serverChallengeIndex = 0;
  state.serverPhase = null;
  state.answeredCurrentChallenge = false;
  state.submittingAnswer = false;
  state.lastSubmitResult = null;
  state.cachedLeaderboard = null;
  state.selectedAnswer = null;
  state.currentOrderSelection = [];
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
    questionTime: saved.questionTime || QUESTION_TIME,
    startedAt: saved.startedAt,
    arenaEndsAt: saved.arenaEndsAt,
    serverClockOffset: saved.serverClockOffset || 0
  });

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);

    if (!response.ok) {
      clearSession();
      resetRoomState();
      return;
    }

    applyRoomSync(data);

    if (data.status === "closed" || data.phase === "closed") {
      await handleRoomClosed("Arena a fost închisă.");
      return;
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
        resetRoomState();
        return;
      }

      state.currentPack = packData.pack;
      state.questionTime = packData.questionTime || QUESTION_TIME;
      applyRoomSync(packData);

      if (data.status === "finished" || data.phase === "done") {
        await showLeaderboard();
      } else {
        dom.playerNameText.textContent = state.currentPlayerName || "Player";
        showScreen(dom.screens.challenge);
        mountArenaActionButtons("challenge");
        startSyncedLoop();
      }
    }
  } catch {
    clearSession();
    resetRoomState();
  }
}

// ─── Server authoritative timing ──────────────────────────────────────────────

function syncClock(serverNowValue) {
  if (typeof serverNowValue !== "number") return;

  state.serverClockOffset = serverNowValue - Date.now();
}

function serverNow() {
  return Date.now() + Number(state.serverClockOffset || 0);
}

function applyRoomSync(data) {
  if (!data) return;

  syncClock(data.serverNow);

  if (data.startedAt) {
    state.startedAt = Number(data.startedAt);
  }

  if (data.endsAt) {
    state.arenaEndsAt = Number(data.endsAt);
  }

  if (data.questionTime) {
    state.questionTime = Number(data.questionTime);
  }

  if (Array.isArray(data.players)) {
    state.playerCount = data.players.length;
  }

  if (typeof data.currentChallengeIndex === "number") {
    state.serverChallengeIndex = data.currentChallengeIndex;
  }

  if (data.phase) {
    state.serverPhase = data.phase;
  }
}

function getTimedPhase() {
  if (!state.startedAt || !state.currentPack) {
    return {
      phase: "waiting",
      challengeIndex: 0,
      timeLeft: state.questionTime || QUESTION_TIME
    };
  }

  const questionTime = state.questionTime || QUESTION_TIME;
  const elapsed = Math.max(0, serverNow() - Number(state.startedAt));
  const total = state.currentPack.challenges.length;
  const cycleMs = (questionTime + RESULT_DURATION + LB_DURATION) * 1000;
  const cycleIndex = Math.floor(elapsed / cycleMs);
  const timeInCycle = elapsed % cycleMs;

  if (cycleIndex >= total) {
    return {
      phase: "done",
      challengeIndex: total - 1,
      timeLeft: 0
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

async function syncRoomFromServer(force = false) {
  if (!state.currentRoomCode) return null;

  const now = Date.now();

  if (!force && now - Number(state.lastPollTime || 0) < 650) {
    return null;
  }

  state.lastPollTime = now;

  try {
    const { response, data } = await api.fetchRoom(state.currentRoomCode);

    if (!response.ok) {
      return null;
    }

    applyRoomSync(data);

    if (data.status === "closed" || data.phase === "closed") {
      return {
        ...data,
        shouldHandleClosed: true
      };
    }

    if (data.status === "finished" || data.phase === "done") {
      return {
        ...data,
        shouldShowLeaderboard: true
      };
    }

    return data;
  } catch {
    return null;
  }
}

function resetQuestionLocalState(challengeIndex) {
  state.currentChallengeIndex = challengeIndex;
  state.answeredCurrentChallenge = false;
  state.submittingAnswer = false;
  state.lastSubmitResult = null;
  state.cachedLeaderboard = null;
  state.selectedAnswer = null;
  state.currentOrderSelection = [];
}

function hideManualNextButton() {
  if (dom.nextChallengeBtn) {
    dom.nextChallengeBtn.classList.add("hidden");
  }
}

async function ensureAnswerSubmittedForIndex(challengeIndex) {
  if (state.answeredCurrentChallenge || state.submittingAnswer) {
    return;
  }

  const challenge = state.currentPack?.challenges?.[challengeIndex];

  if (!challenge) return;

  await submitAnswerForIndex(challengeIndex, "__TIMEOUT__", 0, true);
}

function startSyncedLoop() {
  if (state.syncLoop) {
    clearInterval(state.syncLoop);
  }

  let trackedChallenge = -1;
  let trackedPhase = "";

  state.syncLoop = setInterval(async () => {
    if (state.syncTickRunning) return;

    state.syncTickRunning = true;

    try {
      const synced = await syncRoomFromServer(false);

      if (synced?.shouldHandleClosed) {
        await handleRoomClosed("Arena a fost închisă de creator.");
        return;
      }

      if (synced?.shouldShowLeaderboard) {
        stopGameLoops();
        removeArenaActionButtons();
        await showLeaderboard();
        return;
      }

      const arena = getTimedPhase();

      if (arena.phase === "done") {
        stopGameLoops();
        removeArenaActionButtons();
        await showLeaderboard();
        return;
      }

      const phaseChanged = arena.phase !== trackedPhase;
      const challengeChanged = arena.challengeIndex !== trackedChallenge;

      if (arena.phase === "question") {
        if (phaseChanged || challengeChanged) {
          trackedPhase = "question";
          trackedChallenge = arena.challengeIndex;

          resetQuestionLocalState(arena.challengeIndex);
          saveSession();

          const progress = Math.round(
            (arena.challengeIndex / state.currentPack.challenges.length) * 100
          );

          dom.progressText.textContent = `${progress}%`;
          dom.progressBar.style.width = `${progress}%`;
          dom.scoreText.textContent = state.localScore;
          dom.challengeNumberText.textContent = arena.challengeIndex + 1;

          hideManualNextButton();
          mountArenaActionButtons("challenge");
          renderChallenge(submitCurrentAnswer);
        }

        state.timeLeft = arena.timeLeft;
        updateTimerUI();
        hideManualNextButton();

        if (!state.answeredCurrentChallenge && arena.timeLeft <= 0) {
          await ensureAnswerSubmittedForIndex(arena.challengeIndex);
        }
      }

      if (arena.phase === "result") {
        if (!state.answeredCurrentChallenge) {
          await ensureAnswerSubmittedForIndex(arena.challengeIndex);
        }

        if (phaseChanged || challengeChanged) {
          trackedPhase = "result";
          trackedChallenge = arena.challengeIndex;

          state.currentChallengeIndex = arena.challengeIndex;
          state.timeLeft = arena.timeLeft;

          hideManualNextButton();
          mountArenaActionButtons("challenge");

          renderResultPhase(
            state.currentPack.challenges[arena.challengeIndex],
            state.lastSubmitResult
          );
        }
      }

      if (arena.phase === "leaderboard") {
        if (phaseChanged || challengeChanged) {
          trackedPhase = "leaderboard";
          trackedChallenge = arena.challengeIndex;

          state.currentChallengeIndex = arena.challengeIndex;
          state.timeLeft = arena.timeLeft;

          hideManualNextButton();
          mountArenaActionButtons("challenge");

          try {
            const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

            if (response.ok) {
              syncClock(data.serverNow);
              state.cachedLeaderboard = data;
            } else if (data.error?.includes("închis")) {
              await handleRoomClosed("Arena a fost închisă de creator.");
              return;
            }
          } catch {
            // ignore temporary leaderboard errors
          }

          const isLast =
            arena.challengeIndex >= state.currentPack.challenges.length - 1;

          renderMiniLeaderboard(state.cachedLeaderboard, state.currentPack, isLast);
        }

        const countdown = document.getElementById("lbCountdown");

        if (countdown) {
          countdown.textContent = `Next in ${arena.timeLeft}s`;
        }
      }
    } finally {
      state.syncTickRunning = false;
    }
  }, 250);
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

async function submitAnswerForIndex(challengeIndex, selectedAnswer, timeLeft, isTimeout = false) {
  if (state.submittingAnswer) return;

  state.submittingAnswer = true;
  state.answeredCurrentChallenge = true;

  if (!isTimeout) {
    dom.submitAnswerBtn.disabled = true;
    renderLockedState();
  }

  try {
    const { response, data } = await api.submitAnswer(
      state.currentRoomCode,
      state.currentPlayerId,
      challengeIndex,
      selectedAnswer,
      timeLeft
    );

    if (!response.ok) {
      if (data.error?.includes("închis")) {
        await handleRoomClosed("Arena a fost închisă de creator.");
        return;
      }

      throw new Error(data.error || "Could not submit answer.");
    }

    if (!data.alreadyAnswered) {
      state.localScore = data.score;
      state.lastSubmitResult = data;
      dom.scoreText.textContent = state.localScore;
    }

    applyRoomSync(data);
    saveSession();

    if (data.status === "closed" || data.phase === "closed") {
      await handleRoomClosed("Arena a fost închisă de creator.");
      return;
    }

    if (data.status === "finished" || data.phase === "done") {
      stopGameLoops();
      removeArenaActionButtons();
      await showLeaderboard();
    }
  } catch (error) {
    console.error(error);

    if (!isTimeout) {
      state.answeredCurrentChallenge = false;
      dom.submitAnswerBtn.disabled = false;
      showToast(error.message || "Nu am putut trimite răspunsul.", "danger");
    }
  } finally {
    state.submittingAnswer = false;
  }
}

async function submitCurrentAnswer() {
  const challenge = state.currentPack.challenges[state.currentChallengeIndex];

  if (challenge.type === "order_steps") {
    state.selectedAnswer = [...state.currentOrderSelection];
  }

  if (!hasValidAnswer(challenge)) return;
  if (state.answeredCurrentChallenge || state.submittingAnswer) return;

  await submitAnswerForIndex(
    state.currentChallengeIndex,
    state.selectedAnswer,
    state.timeLeft,
    false
  );
}

// ─── Room lifecycle ───────────────────────────────────────────────────────────

function stopGameLoops() {
  if (state.syncLoop) {
    clearInterval(state.syncLoop);
    state.syncLoop = null;
  }

  if (state.lobbyPoll) {
    clearInterval(state.lobbyPoll);
    state.lobbyPoll = null;
  }

  if (state.arenaEndWatcher) {
    clearInterval(state.arenaEndWatcher);
    state.arenaEndWatcher = null;
  }
}

async function loadPackAndStart() {
  if (state.packLoading) return;

  state.packLoading = true;

  if (state.lobbyPoll) {
    clearInterval(state.lobbyPoll);
    state.lobbyPoll = null;
  }

  const { response, data } = await api.fetchPack(state.currentRoomCode);

  if (!response.ok) {
    if (data.error?.includes("închis")) {
      await handleRoomClosed("Arena a fost închisă de creator.");
      return;
    }

    dom.lobbyStatusText.textContent = data.error || "Pack not available.";
    state.packLoading = false;
    return;
  }

  state.currentPack = data.pack;
  state.questionTime = data.questionTime || QUESTION_TIME;
  state.localScore = 0;

  applyRoomSync(data);
  saveSession();

  dom.playerNameText.textContent = state.currentPlayerName || "Player";

  showScreen(dom.screens.challenge);
  mountArenaActionButtons("challenge");
  startSyncedLoop();

  state.packLoading = false;
}

// ─── Arena action buttons: Close / Leave / Abandon / Invite ───────────────────

function removeArenaActionButtons() {
  document.getElementById("efArenaActions")?.remove();
}

function mountArenaActionButtons(context) {
  removeArenaActionButtons();

  if (!state.currentRoomCode || !state.currentPlayerId) return;

  const wrapper = document.createElement("div");

  wrapper.id = "efArenaActions";
  wrapper.style.position = "fixed";
  wrapper.style.right = "22px";
  wrapper.style.bottom = "22px";
  wrapper.style.zIndex = "60";
  wrapper.style.display = "flex";
  wrapper.style.gap = "10px";
  wrapper.style.alignItems = "center";
  wrapper.style.flexWrap = "wrap";
  wrapper.style.justifyContent = "flex-end";
  wrapper.style.maxWidth = "calc(100vw - 44px)";

  if (state.isHost && context === "lobby" && state.currentUser) {
    const inviteButton = document.createElement("button");

    inviteButton.type = "button";
    inviteButton.className = "btn btn-secondary";
    inviteButton.textContent = "Invite friends";

    inviteButton.addEventListener("click", () => {
      showInviteFriendsModal({
        roomCode: state.currentRoomCode,
        currentUser: state.currentUser
      });
    });

    wrapper.appendChild(inviteButton);
  }

  const button = document.createElement("button");

  button.type = "button";
  button.className = state.isHost ? "btn" : "btn btn-secondary";

  if (state.isHost) {
    button.textContent = context === "lobby" ? "Close arena" : "Close quiz";
    button.addEventListener("click", closeCurrentArena);
  } else {
    button.textContent = context === "lobby" ? "Leave lobby" : "Abandon quiz";
    button.addEventListener("click", leaveCurrentArena);
  }

  wrapper.appendChild(button);
  document.body.appendChild(wrapper);
}

async function goHomeAfterArena() {
  if (state.currentUser) {
    await showDashboard();
  } else {
    setupGuestHeader();
    showScreen(dom.screens.home, false);
  }
}

async function closeCurrentArena() {
  if (!state.currentRoomCode || !state.currentPlayerId) return;

  const ok = await showConfirm({
    title: "Close arena?",
    message:
      "Închizi arena pentru toți playerii. Quizul nu va fi salvat în history și nu va crește streak-ul nimănui.",
    confirmText: "Close arena",
    cancelText: "Cancel",
    danger: true
  });

  if (!ok) return;

  try {
    const { response, data } = await api.closeRoom(
      state.currentRoomCode,
      state.currentPlayerId
    );

    if (!response.ok) {
      throw new Error(data.error || "Nu am putut închide arena.");
    }

    stopGameLoops();
    clearSession();
    resetRoomState();
    removeArenaActionButtons();

    showToast("Arena a fost închisă.", "success");
    await goHomeAfterArena();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Nu am putut închide arena.", "danger");
  }
}

async function leaveCurrentArena() {
  if (!state.currentRoomCode || !state.currentPlayerId) return;

  const isLobby = !state.currentPack;

  const ok = await showConfirm({
    title: isLobby ? "Leave lobby?" : "Abandon quiz?",
    message: isLobby
      ? "Părăsești lobby-ul?"
      : "Abandonezi quizul? Nu va fi adăugat la streak sau la quiz count.",
    confirmText: isLobby ? "Leave lobby" : "Abandon quiz",
    cancelText: "Cancel",
    danger: !isLobby
  });

  if (!ok) return;

  try {
    const { response, data } = await api.leaveRoom(
      state.currentRoomCode,
      state.currentPlayerId
    );

    if (!response.ok) {
      throw new Error(data.error || "Nu am putut părăsi arena.");
    }

    stopGameLoops();
    clearSession();
    resetRoomState();
    removeArenaActionButtons();

    showToast(isLobby ? "Ai părăsit lobby-ul." : "Ai abandonat quizul.", "success");
    await goHomeAfterArena();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Nu am putut părăsi arena.", "danger");
  }
}

async function handleRoomClosed(message = "Arena a fost închisă.") {
  stopGameLoops();
  clearSession();
  resetRoomState();
  removeArenaActionButtons();

  await showNotice({
    title: "Arena closed",
    message,
    variant: "info",
    buttonText: "OK"
  });

  await goHomeAfterArena();
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

  mountArenaActionButtons("lobby");

  await refreshRoomInfo();
}

async function refreshRoomInfo() {
  const { response, data } = await api.fetchRoom(state.currentRoomCode);

  if (!response.ok) {
    dom.lobbyStatusText.textContent = data.error || "Room not found.";
    return;
  }

  applyRoomSync(data);

  if (data.status === "closed" || data.phase === "closed") {
    await handleRoomClosed("Arena a fost închisă de creator.");
    return;
  }

  dom.roomTitleText.textContent = data.packTitle || "Generated arena";
  dom.roomSummaryText.textContent = data.packSummary || "";

  renderPlayerList(data.players);
  renderConceptPills(data.concepts);

  mountArenaActionButtons("lobby");

  if (data.status === "started" && !state.currentPack) {
    await loadPackAndStart();
  }

  if (data.status === "finished") {
    await showLeaderboard();
  }
}

function startLobbyPolling() {
  if (state.lobbyPoll) {
    clearInterval(state.lobbyPoll);
  }

  state.lobbyPoll = setInterval(refreshRoomInfo, 800);
}

async function showLeaderboard() {
  stopGameLoops();
  removeArenaActionButtons();

  const { response, data } = await api.fetchLeaderboard(state.currentRoomCode);

  if (!response.ok) {
    if (data.error?.includes("închis")) {
      await handleRoomClosed("Arena a fost închisă de creator.");
      return;
    }

    showToast(data.error || "Could not load leaderboard.", "danger");
    return;
  }

  syncClock(data.serverNow);

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
  const file = dom.fileInput.files[0];

  const hostName =
    dom.hostNameInput.value.trim() ||
    state.userProfile?.username ||
    state.currentUser?.email?.split("@")[0] ||
    "Guest";

  if (!file) {
    dom.hostStatusText.textContent = "Choose a document first.";
    showToast("Choose a document first.", "info");
    return;
  }

showLoadingOverlay({
  title: "Forging your arena...",
  message: "Reading your document.",
  steps: [
    "Reading document",
    "Extracting concepts",
    "Generating challenges",
    "Checking quality",
    "Opening lobby"
  ]
});

  dom.createArenaBtn.disabled = true;
  dom.hostStatusText.textContent = "Starting...";

  try {
    const formData = new FormData();

    formData.append("document", file);
    formData.append("gameMode", state.selectedGameMode);

    const packData = await api.generatePack(formData, message => {
      dom.hostStatusText.textContent = message;
      updateLoadingOverlay(message);
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

    updateLoadingOverlay("Opening lobby...", 92);

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
    showToast(error.message || "Something went wrong.", "danger");
  } finally {
    hideLoadingOverlay();
    dom.createArenaBtn.disabled = false;
  }
}

async function joinArena() {
  const code = dom.joinCodeInput.value.trim().toUpperCase();

  const name =
    dom.joinNameInput.value.trim() ||
    state.userProfile?.username ||
    state.currentUser?.email?.split("@")[0] ||
    "Guest";

  if (!code) {
    dom.joinStatusText.textContent = "Enter room code.";
    showToast("Enter room code.", "info");
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
    showToast(error.message || "Could not join room.", "danger");
  } finally {
    dom.joinArenaBtn.disabled = false;
  }
}

async function joinRoomWithName(code, name) {
  const userId = state.currentUser?.id || null;

  const { response, data } = await api.joinRoom(code, name, userId);

  if (!response.ok) {
    throw new Error(data.error || "Could not join room.");
  }

  syncClock(data.serverNow);

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

    applyRoomSync(data);

    await loadPackAndStart();
  } catch (error) {
    console.error(error);
    dom.lobbyStatusText.textContent = error.message || "Could not start.";
    showToast(error.message || "Could not start.", "danger");
  } finally {
    dom.startArenaBtn.disabled = false;
  }
}

async function copyJoinLink() {
  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomCode}`;

  try {
    await navigator.clipboard.writeText(link);
    dom.lobbyStatusText.textContent = "Link copied.";
    showToast("Link copied.", "success");
  } catch {
    dom.lobbyStatusText.textContent = link;
    showToast("Nu am putut copia linkul automat.", "danger");
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
    showToast(error.message || "Could not generate lesson.", "danger");
  } finally {
    dom.generateLessonBtn.disabled = false;
    dom.generateLessonBtn.textContent = "Generate AI lesson";
  }
}

// ─── History navigation ───────────────────────────────────────────────────────

history.replaceState({ screen: "home" }, "", window.location.href);

window.addEventListener("popstate", event => {
  const name = event.state?.screen || "home";
  const screen = dom.screens[name] || dom.screens.home;

  stopGameLoops();
  removeArenaActionButtons();

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