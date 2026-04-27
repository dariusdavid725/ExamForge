import { getSupabase } from "../shared/supabaseClient.js";
import { logout } from "../shared/auth.js";
import { showHistoryDetailModal } from "./historyDetail.js";
import { showFriendManagerModal } from "../components/friendManager.js";

// ─── Save completed game ──────────────────────────────────────────────────────

export async function saveGameSession({
  user,
  profile,
  pack,
  roomCode,
  documentName,
  documentText,
  leaderboardData
}) {
  try {
    const response = await fetch("/api/sessions/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        hostId: user.id,
        pack,
        roomCode,
        documentName,
        documentText,
        leaderboardData
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("saveGameSession backend error:", data.error);
      return null;
    }

    return data.sessionId || null;
  } catch (err) {
    console.error("saveGameSession error:", err);
    return null;
  }
}
// ─── Dashboard render ─────────────────────────────────────────────────────────

export async function renderDashboard(
  container,
  user,
  profile,
  { onCreateArena, onJoinArena, onHistory }
) {
  const sb = await getSupabase();

  const sessions = await getSessionsForUser(sb, user.id, 2);  // Show 2 instead of 3
  const friendProfiles = await getFriendProfiles(sb, user.id);

  // Fetch fresh progress stats
  let progressStats = null;
  try {
    const res = await fetch(`/api/progress/stats?userId=${user.id}&days=7`);
    if (res.ok) progressStats = await res.json();
  } catch (err) {
    console.log("Could not fetch progress stats:", err);
  }

  const streak      = progressStats?.currentStreak || profile?.streak_count  || 0;
  const maxStreak   = progressStats?.longestStreak || profile?.max_streak    || 0;
  const totalQuizzes = progressStats?.totalQuizzes || profile?.total_quizzes || 0;
  const totalPoints  = profile?.total_points  || 0;
  const overallAccuracy = progressStats?.overallAccuracy || 0;
  const thisWeekQuizzes = progressStats?.dailyProgress?.reduce((sum, day) => sum + (day.quizzes_completed || 0), 0) || 0;
  const avatarLetter = (profile?.username || user.email || "U")[0].toUpperCase();
  const avatarColor  = profile?.avatar_color  || "#4f46e5";
  const isPremium    = (profile?.plan || "free") === "premium";
  const isAdmin      = Boolean(profile?.is_admin) || String(user?.email || "").toLowerCase() === "dariusdavid26@yahoo.com";

  container.innerHTML = `
    <div class="dash-layout">

      <!-- ── LEFT COLUMN: profile + plan ── -->
      <div class="dash-col">

        <div class="card dash-profile-card">
          <div class="row" style="align-items:center;gap:12px;">
            <div style="position:relative;flex-shrink:0;">
              ${isPremium ? `<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);
                font-size:17px;line-height:1;z-index:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.25));">👑</span>` : ""}
              <div class="dash-avatar" style="background:${avatarColor};">${escapeHTML(avatarLetter)}</div>
            </div>
            <div style="min-width:0;">
              <h2 style="font-size:18px;letter-spacing:-.03em;line-height:1.2;">${escapeHTML(profile?.username || "Player")}</h2>
              <p class="muted" style="font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(user.email || "")}</p>
              ${isPremium ? `<span style="display:inline-block;margin-top:4px;background:#c9a227;color:white;
                font-size:10px;font-weight:900;padding:2px 8px;border-radius:999px;border:2px solid var(--text);">⭐ PREMIUM</span>` : ""}
            </div>
          </div>

          <div class="dash-stats-row" style="margin-top:10px;">
            <div class="dash-stat">
              <div class="dash-stat-val">${streak > 0 ? streak + " 🔥" : streak}</div>
              <div class="dash-stat-label">Streak</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-val">${maxStreak}</div>
              <div class="dash-stat-label">Best</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-val">${totalQuizzes}</div>
              <div class="dash-stat-label">Quizuri</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-val">${totalPoints}</div>
              <div class="dash-stat-label">Puncte</div>
            </div>
          </div>

          <button id="logoutBtn" class="btn btn-secondary" type="button"
            style="margin-top:10px;padding:6px 14px;font-size:12px;width:100%;">
            Logout
          </button>
        </div>

        <!-- Plan card — filled async by renderPlanCard() -->
        <div class="card" id="planCard" style="min-height:50px;">
          <p class="muted" style="font-size:12px;">Loading plan...</p>
        </div>

      </div>

      <!-- ── RIGHT COLUMN: actions + friends side by side ── -->
      <div class="dash-col">

        <!-- TOP ROW: Quick Start + Stats (left) | Friends (right) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start;">
          
          <!-- LEFT: Quick Start + Stats below -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            <!-- Quick Start -->
            <div class="card" style="padding:12px 14px 12px;">
              <div class="eyebrow" style="font-size:10px;margin-bottom:10px;">QUICK START</div>
              <div style="display:grid;gap:8px;">
                <button id="dashCreateBtn" class="btn" type="button" style="padding:12px;font-size:13px;">⚡ Create Arena</button>
                <button id="dashJoinBtn"   class="btn btn-secondary" type="button" style="padding:12px;font-size:13px;">Join Arena</button>
                <a href="/lessons"         class="btn btn-secondary" style="padding:12px;font-size:13px;text-align:center;display:block;">📚 My Lessons</a>
                <button id="dashHistoryBtn" class="btn btn-secondary" type="button" style="padding:12px;font-size:13px;">📊 My History</button>
                ${isAdmin ? `<a href="/admin" class="btn btn-secondary" style="padding:12px;font-size:13px;text-align:center;display:block;">🛠 Admin Panel</a>` : ""}
              </div>
            </div>

            <!-- Stats below Quick Start -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="flat-card" style="padding:8px;text-align:center;">
                <div style="font-size:8px;font-weight:700;color:var(--muted);margin-bottom:3px;letter-spacing:0.05em;">ACCURACY</div>
                <div style="font-size:18px;font-weight:900;line-height:1;color:${overallAccuracy >= 80 ? 'var(--green)' : overallAccuracy >= 60 ? 'var(--blue)' : 'var(--muted)'};">${overallAccuracy || 0}%</div>
              </div>
              <div class="flat-card" style="padding:8px;text-align:center;">
                <div style="font-size:8px;font-weight:700;color:var(--muted);margin-bottom:3px;letter-spacing:0.05em;">THIS WEEK</div>
                <div style="font-size:18px;font-weight:900;line-height:1;color:var(--blue);">${thisWeekQuizzes || 0}</div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Friends Leaderboard -->
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div class="eyebrow" style="font-size:10px;">FRIENDS</div>
              <button id="addFriendBtn" class="btn btn-secondary" type="button"
                style="padding:3px 8px;font-size:10px;">Manage</button>
            </div>
            <div style="display:grid;gap:5px;">
              ${friendProfiles.length > 0 
                ? renderFriendsLb(friendProfiles, user.id, 5)
                : `<p class="muted" style="font-size:11px;margin:3px 0;">No friends yet</p>`}
            </div>
            ${friendProfiles.length > 5 
              ? `<button id="seeMoreFriendsBtn" class="btn btn-secondary" type="button"
                  style="margin-top:8px;padding:6px;font-size:10px;width:100%;">
                  See all ${friendProfiles.length} friends
                </button>`
              : ''}
          </div>

        </div>

        <!-- Friend Requests (if any) -->
        <div id="pendingRequestsCard" class="card" style="display:none;">
          <div class="eyebrow" style="font-size:9px;margin-bottom:6px;">FRIEND REQUESTS</div>
          <div id="pendingRequestsList" style="display:grid;gap:5px;"></div>
        </div>

      </div>
    </div>
  `;

  container.querySelector("#logoutBtn")?.addEventListener("click", async () => {
    await logout();
    location.reload();
  });

  container.querySelector("#dashCreateBtn")?.addEventListener("click", onCreateArena);
  container.querySelector("#dashJoinBtn")?.addEventListener("click", onJoinArena);
  container.querySelector("#dashHistoryBtn")?.addEventListener("click", onHistory);
  container.querySelector("#addFriendBtn")?.addEventListener("click", () => showFriendManagerModal(user.id));
  container.querySelector("#seeMoreFriendsBtn")?.addEventListener("click", () => showFriendManagerModal(user.id));

  container.querySelectorAll("[data-session-id]").forEach(button => {
    button.addEventListener("click", () => {
      showHistoryDetailModal(button.dataset.sessionId, sb);
    });
  });

  await loadPendingRequests(sb, user.id, container);
  renderPlanCard(container, user.id);   // fire-and-forget, fills #planCard async
}

// ─── Plan / Subscription card ─────────────────────────────────────────────────

async function renderPlanCard(container, userId) {
  const card = container.querySelector("#planCard");
  if (!card) return;

  try {
    const res  = await fetch(`/api/stripe/plan-status?userId=${userId}`);
    if (!res.ok) { card.style.display = "none"; return; }
    const data = await res.json();

    if (data.plan === "premium") {
      card.style.borderColor   = "#c9a227";
      card.style.boxShadow     = "4px 4px 0 #c9a227";
      card.style.background    = "linear-gradient(135deg,#fffdf4,#fff8dc)";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:900;color:#8a6800;">⭐ PREMIUM ACTIVE</span>
        </div>
        <button id="manageSubBtn" class="btn btn-secondary" type="button"
          style="width:100%;padding:8px;font-size:12px;margin-top:8px;">
          Manage Subscription
        </button>`;

      card.querySelector("#manageSubBtn")?.addEventListener("click", async () => {
        try {
          const r = await fetch("/api/stripe/portal-session", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
          });
          const d = await r.json();
          if (d.url) window.location.href = d.url;
        } catch { alert("Nu am putut deschide portalul. Incearca din nou."); }
      });

    } else {
      const lu = data.weeklyLessonsUsed || 0;
      const qu = data.weeklyQuizzesUsed || 0;
      const lColor = lu >= 3 ? "var(--red)" : lu >= 2 ? "var(--orange)" : "var(--blue)";
      const qColor = qu >= 3 ? "var(--red)" : qu >= 2 ? "var(--orange)" : "var(--blue)";

      card.innerHTML = `
        <div class="eyebrow" style="font-size:9px;background:var(--paper-2);color:var(--text);margin-bottom:10px;">FREE PLAN</div>
        
        <p class="muted" style="font-size:10px;margin-bottom:10px;line-height:1.5;">
          Your weekly usage refreshes every Monday
        </p>

        <div style="display:grid;gap:10px;margin-bottom:12px;">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:4px;">
              <span>📚 Lessons</span>
              <span style="color:${lColor};">${lu}/3</span>
            </div>
            <div class="progress-track" style="height:6px;">
              <div class="progress-fill" style="width:${Math.min(100,(lu/3)*100)}%;background:${lColor};"></div>
            </div>
            ${lu >= 3 ? `<p class="muted" style="font-size:9px;margin-top:3px;color:var(--red);">Limit reached this week</p>` : ''}
          </div>
          
          <div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:4px;">
              <span>⚡ Arenas</span>
              <span style="color:${qColor};">${qu}/3</span>
            </div>
            <div class="progress-track" style="height:6px;">
              <div class="progress-fill" style="width:${Math.min(100,(qu/3)*100)}%;background:${qColor};"></div>
            </div>
            ${qu >= 3 ? `<p class="muted" style="font-size:9px;margin-top:3px;color:var(--red);">Limit reached this week</p>` : ''}
          </div>
        </div>

        <a href="/pricing" class="btn" style="display:block;text-align:center;padding:8px;font-size:11px;">
          ⭐ Upgrade to Premium — €5/mo
        </a>
        
        <p class="muted" style="font-size:8px;margin-top:8px;text-align:center;line-height:1.4;">
          Premium: Unlimited lessons, arenas & AI features
        </p>`;
    }
  } catch { card.style.display = "none"; }
}

// ─── My History page render ───────────────────────────────────────────────────

export async function renderHistoryPage(container, user) {
  const sb = await getSupabase();

  container.innerHTML = `
    <div class="card">
      <p class="muted">Loading history...</p>
    </div>
  `;

  const sessions = await getSessionsForUser(sb, user.id, 100);

  if (!sessions.length) {
    container.innerHTML = `
      <div class="card">
        <p class="muted">No quizzes yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h2>My History</h2>
      <p class="muted" style="margin-top:8px;">
        Quizzes you hosted or participated in.
      </p>

      <div style="display:grid; gap:12px; margin-top:18px;">
        ${sessions
          .map(session => {
            const myResult = (session.game_results || []).find(result => {
              return result.user_id === user.id;
            });

            const subtitle = myResult
              ? `Your result: #${myResult.rank} · ${myResult.score} pts · ${myResult.correct_count}/${myResult.total_answered} correct`
              : `Hosted by you · ${session.player_count || 0} players`;

            return renderSessionRow(session, "Details", subtitle);
          })
          .join("")}
      </div>
    </div>
  `;

  container.querySelectorAll("[data-session-id]").forEach(button => {
    button.addEventListener("click", () => {
      showHistoryDetailModal(button.dataset.sessionId, sb);
    });
  });
}

function renderSessionRow(session, actionText = "Details", extraLine = "") {
  return `
    <button class="dash-session-row" data-session-id="${session.id}" type="button"
      style="padding:9px 12px;">
      <div style="text-align:left;min-width:0;">
        <strong style="font-size:13px;">${escapeHTML(session.title || "Quiz")}</strong>
        <p class="muted" style="font-size:11px;margin-top:2px;">
          ${escapeHTML(session.category || "Quiz")} · ${session.player_count || 0} players · ${formatDate(session.played_at)}
        </p>
        ${extraLine ? `<p class="muted" style="font-size:11px;margin-top:1px;">${escapeHTML(extraLine)}</p>` : ""}
      </div>
      <span style="font-weight:900;flex-shrink:0;font-size:15px;">${escapeHTML(actionText)}</span>
    </button>
  `;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function getSessionsForUser(sb, userId, limit = 5) {
  const { data: hostedSessions } = await sb
    .from("game_sessions")
    .select("*, game_results(*)")
    .eq("host_id", userId)
    .order("played_at", {
      ascending: false
    })
    .limit(limit);

  const { data: participatedResults } = await sb
    .from("game_results")
    .select("session_id")
    .eq("user_id", userId);

  const participatedIds = [
    ...new Set((participatedResults || []).map(result => result.session_id))
  ];

  let participatedSessions = [];

  if (participatedIds.length > 0) {
    const { data } = await sb
      .from("game_sessions")
      .select("*, game_results(*)")
      .in("id", participatedIds)
      .order("played_at", {
        ascending: false
      })
      .limit(limit);

    participatedSessions = data || [];
  }

  const sessionsMap = new Map();

  [...(hostedSessions || []), ...participatedSessions].forEach(session => {
    sessionsMap.set(session.id, session);
  });

  return [...sessionsMap.values()]
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    .slice(0, limit);
}

async function getFriendProfiles(sb, userId) {
  const { data: friendships } = await sb
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");

  const friendIds = (friendships || []).map(friendship =>
    friendship.requester_id === userId
      ? friendship.addressee_id
      : friendship.requester_id
  );

  friendIds.push(userId);

  const uniqueFriendIds = [...new Set(friendIds)];

  if (uniqueFriendIds.length === 0) return [];

  const { data: profiles } = await sb
    .from("profiles")
    .select("*")
    .in("id", uniqueFriendIds);

  return profiles || [];
}

// ─── Friends ──────────────────────────────────────────────────────────────────

function renderFriendsLb(profiles, currentUserId, limit = null) {
  if (!profiles.length) {
    return `
      <p class="muted" style="font-size:12px;margin:3px 0;">Add friends to see the leaderboard!</p>
    `;
  }

  const sorted = [...profiles].sort((a, b) =>
    (b.total_points || 0) - (a.total_points || 0)
  );

  const displayProfiles = limit ? sorted.slice(0, limit) : sorted;

  return displayProfiles
    .map((profile, index) => {
      const rating = profile.total_points || 0;

      const letter     = (profile.username || "U")[0].toUpperCase();
      const color      = profile.avatar_color || "#4f46e5";
      const isMe       = profile.id === currentUserId;
      const premium    = (profile.plan || "free") === "premium";
      const streak     = profile.streak_count || 0;

      const avatarStyle = premium
        ? `background:linear-gradient(135deg,#c9a227,#f5d060);border-color:#c9a227;`
        : `background:${color};`;

      return `
        <div class="dash-session-row${premium ? " premium-friend" : ""}" style="cursor:default;">
          <div class="row" style="gap:10px;min-width:0;">
            <span class="rank" style="min-width:18px;">${index + 1}</span>

            <div style="position:relative;flex-shrink:0;">
              ${premium ? `<span style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);
                font-size:12px;line-height:1;z-index:1;">👑</span>` : ""}
              <div class="dash-avatar-sm" style="${avatarStyle}">
                ${escapeHTML(letter)}
              </div>
            </div>

            <div style="min-width:0;">
              <strong style="${premium ? "color:#8a6800;" : ""}">
                ${escapeHTML(profile.username || "Player")}${isMe ? " (you)" : ""}
                ${premium ? `<span style="font-size:10px;font-weight:900;background:#c9a227;color:white;
                  padding:1px 6px;border-radius:999px;margin-left:4px;vertical-align:middle;">PRO</span>` : ""}
              </strong>
              <p class="muted" style="font-size:12px;margin-top:1px;">
                ${profile.total_quizzes || 0} quizzes · ${streak > 0 ? streak + " 🔥" : "0 streak"}
              </p>
            </div>
          </div>

          <strong style="${premium ? "color:#8a6800;" : ""}">${rating}</strong>
        </div>
      `;
    })
    .join("");
}

async function loadPendingRequests(sb, userId, container) {
  const { data: requests } = await sb
    .from("friendships")
    .select("id, requester_id, profiles!friendships_requester_id_fkey(username)")
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (!requests || requests.length === 0) return;

  const card = container.querySelector("#pendingRequestsCard");
  const list = container.querySelector("#pendingRequestsList");

  if (!card || !list) return;

  card.style.display = "";

  list.innerHTML = requests
    .map(request => {
      return `
        <div class="dash-session-row" style="cursor:default;">
          <strong>${escapeHTML(request.profiles?.username || "Unknown")}</strong>

          <div class="row">
            <button
              class="btn btn-secondary"
              data-accept-friend="${request.id}"
              type="button"
            >
              Accept
            </button>

            <button
              class="btn"
              data-reject-friend="${request.id}"
              type="button"
            >
              Reject
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll("[data-accept-friend]").forEach(button => {
    button.addEventListener("click", async () => {
      await sb
        .from("friendships")
        .update({
          status: "accepted"
        })
        .eq("id", button.dataset.acceptFriend);

      card.style.display = "none";
      location.reload();
    });
  });

  list.querySelectorAll("[data-reject-friend]").forEach(button => {
    button.addEventListener("click", async () => {
      await sb
        .from("friendships")
        .update({
          status: "rejected"
        })
        .eq("id", button.dataset.rejectFriend);

      location.reload();
    });
  });
}

async function showAddFriendModal(sb, userId) {
  const username = prompt("Enter friend's username:");

  if (!username) return;

  const { data: friend } = await sb
    .from("profiles")
    .select("id, username")
    .eq("username", username.trim())
    .maybeSingle();

  if (!friend) {
    alert("User not found.");
    return;
  }

  if (friend.id === userId) {
    alert("That's you!");
    return;
  }

  const { error } = await sb.from("friendships").insert({
    requester_id: userId,
    addressee_id: friend.id,
    status: "pending"
  });

  if (error) {
    alert("Already sent or already friends.");
    return;
  }

  alert(`Friend request sent to ${friend.username}!`);
}

// ─── Bell notifications ───────────────────────────────────────────────────────

export async function loadNotificationCount(userId) {
  const sb = await getSupabase();

  const { data } = await sb
    .from("friendships")
    .select("id")
    .eq("addressee_id", userId)
    .eq("status", "pending");

  return (data || []).length;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "-";
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}