import { getSession } from "../shared/auth.js";
import { installFeedback } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { renderDashboard, renderHistoryPage } from "../features/dashboard.js";
import { renderRoomInvitesCard } from "../components/roomInvites.js";
import * as api from "../shared/api.js";

let currentUser = null;
let userProfile = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (!auth) { nav.login(); return; }

  currentUser = auth.user;
  userProfile = auth.profile;

  document.getElementById("headerBell")?.addEventListener("click", showHistory);
  document.getElementById("backToDashboard")?.addEventListener("click", showDashboard);

  showDashboard();
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

async function showDashboard() {
  document.getElementById("historyNav")?.classList.add("hidden");
  document.getElementById("historyContent")?.classList.add("hidden");
  document.getElementById("dashboardContent")?.classList.remove("hidden");

  const container = document.getElementById("dashboardContent");
  container.innerHTML = `<div class="card"><p class="muted">Loading dashboard...</p></div>`;

  try {
    await renderDashboard(container, currentUser, userProfile, {
      onCreateArena: () => nav.create(),
      onJoinArena:   () => nav.join(),
      onHistory:     showHistory
    });

    await renderProgressStats(container, currentUser);
    await renderActivationMetrics(container, currentUser);

    await renderRoomInvitesCard(container, currentUser, async invite => {
      const name = userProfile?.username || currentUser?.email?.split("@")[0] || "Player";

      const { response, data } = await api.joinRoom(invite.room_code, name, currentUser.id);
      if (!response.ok) throw new Error(data.error || "Could not join room.");

      await api.respondRoomInvite(invite.id, "accepted");

      sessionStorage.setItem("ef_session", JSON.stringify({
        currentRoomCode:   invite.room_code,
        currentPlayerId:   data.playerId,
        currentPlayerName: name,
        isHost:            false,
        localScore:        0,
        questionTime:      20,
        startedAt:         null,
        arenaEndsAt:       null,
        serverClockOffset: data.serverNow ? data.serverNow - Date.now() : 0
      }));

      nav.arena(invite.room_code);
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    document.getElementById("dashboardContent").innerHTML = `<div class="card"><p class="muted">Could not load dashboard.</p></div>`;
  }
}

async function renderProgressStats(container, user) {
  if (!user) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "14px";
  card.innerHTML = `
    <div class="eyebrow">Your Progress</div>
    <h3 style="margin:10px 0 14px;">Learning Statistics</h3>
    <div class="loading-container" style="padding: 40px 20px;">
      <div class="spinner"></div>
      <div class="loading-text">Loading your stats...</div>
    </div>
  `;
  container.prepend(card);

  try {
    const res = await fetch(`/api/progress/stats?userId=${user.id}&days=7`);
    if (!res.ok) throw new Error("Could not load stats");
    
    const stats = await res.json();

    const { currentStreak, longestStreak, totalQuizzes, totalQuestions, totalCorrect, overallAccuracy, dailyProgress } = stats;

    // Calculate this week's activity
    const thisWeekQuizzes = dailyProgress.reduce((sum, day) => sum + (day.quizzes_completed || 0), 0);
    const thisWeekQuestions = dailyProgress.reduce((sum, day) => sum + (day.total_questions_answered || 0), 0);

    card.innerHTML = `
      <div class="eyebrow">Your Progress</div>
      <h3 style="margin:10px 0 20px;">Learning Statistics</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
        ${currentStreak > 0 ? `
          <div class="stat-card">
            <div class="stat-label">🔥 Current Streak</div>
            <div class="stat-value" style="color: var(--orange);">${currentStreak}</div>
            <div class="stat-change neutral">${currentStreak === 1 ? 'day' : 'days'}</div>
          </div>
        ` : ''}
        
        <div class="stat-card">
          <div class="stat-label">Accuracy</div>
          <div class="stat-value" style="color: ${overallAccuracy >= 80 ? 'var(--green)' : overallAccuracy >= 60 ? 'var(--blue)' : 'var(--orange)'};">${overallAccuracy}%</div>
          <div class="stat-change neutral">Overall</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">Total Quizzes</div>
          <div class="stat-value">${totalQuizzes}</div>
          <div class="stat-change positive">+${thisWeekQuizzes} this week</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">Questions Answered</div>
          <div class="stat-value">${totalQuestions}</div>
          <div class="stat-change positive">+${thisWeekQuestions} this week</div>
        </div>
      </div>

      ${longestStreak > 1 ? `
        <div class="info-state" style="margin-bottom: 0;">
          <div class="state-icon">🏆</div>
          <div class="state-content">
            <div class="state-title">Personal Best</div>
            <p class="state-message">Your longest streak is ${longestStreak} days! ${currentStreak === longestStreak ? "You're on fire! 🔥" : `Keep going to beat it!`}</p>
          </div>
        </div>
      ` : ''}
    `;
  } catch (err) {
    console.error("Progress stats error:", err);
    card.innerHTML = `
      <div class="eyebrow">Your Progress</div>
      <h3 style="margin:10px 0 8px;">Learning Statistics</h3>
      <p class="muted" style="margin:0;">Complete your first quiz to start tracking progress!</p>
    `;
  }
}

async function renderActivationMetrics(container, user) {
  const isBootstrapAdmin = String(user?.email || "").toLowerCase() === "dariusdavid26@yahoo.com";
  if (!userProfile?.is_admin && !isBootstrapAdmin) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "14px";
  card.innerHTML = `
    <div class="eyebrow">Activation Funnel</div>
    <h3 style="margin:10px 0 14px;">Demo conversion (last 7 days)</h3>
    <p class="muted" style="margin:0;">Loading metrics...</p>
  `;
  container.prepend(card);

  try {
    const session = await getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Missing auth session.");

    const response = await fetch("/api/events/stats", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load metrics.");

    const c = data.counts || {};
    const r = data.rates || {};

    card.innerHTML = `
      <div class="eyebrow">Activation Funnel</div>
      <h3 style="margin:10px 0 14px;">Demo conversion (last ${data.windowDays || 7} days)</h3>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:10px;">
        <div class="flat-card"><strong>Clicks</strong><div style="font-size:24px;margin-top:6px;">${c.activation_demo_start_clicked || 0}</div></div>
        <div class="flat-card"><strong>Starts</strong><div style="font-size:24px;margin-top:6px;">${c.activation_demo_started || 0}</div></div>
        <div class="flat-card"><strong>Completions</strong><div style="font-size:24px;margin-top:6px;">${c.activation_demo_completed || 0}</div></div>
      </div>
      <p class="muted" style="margin-top:12px;">
        Click → Start: <strong>${r.clickToStart || 0}%</strong> ·
        Start → Complete: <strong>${r.startToComplete || 0}%</strong> ·
        Click → Complete: <strong>${r.clickToComplete || 0}%</strong>
      </p>
    `;
  } catch {
    card.innerHTML = `
      <div class="eyebrow">Activation Funnel</div>
      <h3 style="margin:10px 0 8px;">Demo conversion</h3>
      <p class="muted" style="margin:0;">Metrics are unavailable right now.</p>
    `;
  }
}

// ─── History view ─────────────────────────────────────────────────────────────

async function showHistory() {
  document.getElementById("dashboardContent")?.classList.add("hidden");
  document.getElementById("historyNav")?.classList.remove("hidden");
  document.getElementById("historyContent")?.classList.remove("hidden");

  const container = document.getElementById("historyContent");
  if (container) await renderHistoryPage(container, currentUser);
}

init();
