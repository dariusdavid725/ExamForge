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

      <!-- ── TOP ROW: Profile + Stats + Logout ── -->
      <div class="dash-top-row card" style="padding:10px 14px;">
        
        <!-- Profile -->
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="position:relative;flex-shrink:0;">
            ${isPremium ? `<span style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);
              font-size:14px;line-height:1;z-index:1;">👑</span>` : ""}
            <div class="dash-avatar" style="background:${avatarColor};width:40px;height:40px;font-size:20px;">${escapeHTML(avatarLetter)}</div>
          </div>
          <div style="min-width:0;">
            <h2 style="font-size:15px;letter-spacing:-.03em;line-height:1.2;margin:0;">${escapeHTML(profile?.username || "Player")}</h2>
            <p class="muted" style="font-size:9px;margin:2px 0 0;">${escapeHTML(user.email || "")}</p>
          </div>
        </div>

        <!-- Stats (inline) -->
        <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;line-height:1;">${streak > 0 ? streak + " 🔥" : streak}</div>
            <div style="font-size:8px;font-weight:800;color:var(--muted);margin-top:2px;">STREAK</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;line-height:1;">${maxStreak}</div>
            <div style="font-size:8px;font-weight:800;color:var(--muted);margin-top:2px;">BEST</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;line-height:1;">${totalQuizzes}</div>
            <div style="font-size:8px;font-weight:800;color:var(--muted);margin-top:2px;">QUIZURI</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;line-height:1;">${totalPoints}</div>
            <div style="font-size:8px;font-weight:800;color:var(--muted);margin-top:2px;">PUNCTE</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;line-height:1;color:${overallAccuracy >= 80 ? 'var(--green)' : overallAccuracy >= 60 ? 'var(--blue)' : 'var(--muted)'};">${overallAccuracy || 0}%</div>
            <div style="font-size:8px;font-weight:800;color:var(--muted);margin-top:2px;">ACCURACY</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;line-height:1;color:var(--blue);">${thisWeekQuizzes || 0}</div>
            <div style="font-size:8px;font-weight:800;color:var(--muted);margin-top:2px;">THIS WEEK</div>
          </div>
        </div>

        <!-- Logout -->
        <button id="logoutBtn" class="btn btn-secondary" type="button"
          style="padding:6px 12px;font-size:10px;white-space:nowrap;">
          Logout
        </button>
      </div>

      <!-- ── 3 COLUMN GRID: Actions | Friends | Plan ── -->
      <div class="dash-grid-3">
        
        <!-- COLUMN 1: Quick Actions -->
        <div class="card">
          <div class="eyebrow" style="font-size:9px;margin-bottom:8px;">QUICK START</div>
          <div style="display:grid;gap:6px;">
            <button id="dashCreateBtn" class="btn" type="button" style="padding:9px;font-size:12px;">⚡ Create Arena</button>
            <button id="dashJoinBtn"   class="btn btn-secondary" type="button" style="padding:9px;font-size:12px;">Join Arena</button>
            <a href="/lessons"         class="btn btn-secondary" style="padding:9px;font-size:12px;text-align:center;display:block;">📚 My Lessons</a>
            <button id="dashHistoryBtn" class="btn btn-secondary" type="button" style="padding:9px;font-size:12px;">📊 My History</button>
            ${isAdmin ? `<a href="/admin" class="btn btn-secondary" style="padding:9px;font-size:12px;text-align:center;display:block;">🛠 Admin</a>` : ""}
          </div>
        </div>

        <!-- COLUMN 2: Friends (top 3-4) -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div class="eyebrow" style="font-size:9px;">FRIENDS</div>
            <button id="addFriendBtn" class="btn btn-secondary" type="button"
              style="padding:3px 7px;font-size:9px;">+</button>
          </div>
          <div style="display:grid;gap:4px;">
            ${friendProfiles.length > 0 
              ? renderFriendsLb(friendProfiles, user.id, 4)
              : `<p class="muted" style="font-size:10px;margin:3px 0;">No friends yet</p>`}
          </div>
          ${friendProfiles.length > 4 
            ? `<button id="seeAllFriendsBtn" class="btn btn-secondary" type="button"
                style="margin-top:6px;padding:5px;font-size:9px;width:100%;">
                +${friendProfiles.length - 4} more
              </button>`
            : ''}
        </div>

        <!-- COLUMN 3: Plan + Requests -->
        <div class="dash-col" style="gap:8px;">
          
          <!-- Plan card (minimal) -->
          <div class="card" id="planCard" style="display:none;">
            <p class="muted" style="font-size:9px;">Loading...</p>
          </div>

          <!-- Friend Requests -->
          <div id="pendingRequestsCard" class="card" style="display:none;">
            <div class="eyebrow" style="font-size:9px;margin-bottom:6px;">REQUESTS</div>
            <div id="pendingRequestsList" style="display:grid;gap:4px;"></div>
          </div>

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
  container.querySelector("#seeAllFriendsBtn")?.addEventListener("click", () => showFriendManagerModal(user.id));

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

    card.style.display = "block";

    if (data.plan === "premium") {
      card.style.borderColor   = "#c9a227";
      card.style.boxShadow     = "3px 3px 0 #c9a227";
      card.style.background    = "linear-gradient(135deg,#fffdf4,#fff8dc)";
      card.innerHTML = `
        <div class="eyebrow" style="font-size:9px;background:#c9a227;margin-bottom:6px;">⭐ PREMIUM</div>
        <button id="manageSubBtn" class="btn btn-secondary" type="button"
          style="padding:7px;font-size:11px;width:100%;">
          Manage Plan
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

      card.innerHTML = `
        <div class="eyebrow" style="font-size:9px;background:var(--paper-2);color:var(--text);margin-bottom:6px;">FREE PLAN</div>
        <div style="font-size:9px;font-weight:800;color:var(--muted);margin-bottom:6px;">
          ${lu}/3 lessons · ${qu}/3 arenas
        </div>
        <a href="/pricing" class="btn" style="display:block;text-align:center;padding:7px;font-size:11px;">
          Upgrade
        </a>`;
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
      style="padding:8px 10px;">
      <div style="text-align:left;min-width:0;">
        <strong style="font-size:12px;">${escapeHTML(session.title || "Quiz")}</strong>
        <p class="muted" style="font-size:10px;margin-top:2px;">
          ${escapeHTML(session.category || "Quiz")} · ${session.player_count || 0} players · ${formatDate(session.played_at)}
        </p>
        ${extraLine ? `<p class="muted" style="font-size:10px;margin-top:1px;">${escapeHTML(extraLine)}</p>` : ""}
      </div>
      <span style="font-weight:900;flex-shrink:0;font-size:13px;">${escapeHTML(actionText)}</span>
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
        <div class="dash-session-row${premium ? " premium-friend" : ""}" style="cursor:default;padding:6px 8px;">
          <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
            <span style="font-size:11px;font-weight:900;min-width:14px;">${index + 1}</span>

            <div style="position:relative;flex-shrink:0;">
              ${premium ? `<span style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);
                font-size:10px;line-height:1;z-index:1;">👑</span>` : ""}
              <div class="dash-avatar-sm" style="${avatarStyle};width:24px;height:24px;font-size:11px;">
                ${escapeHTML(letter)}
              </div>
            </div>

            <div style="min-width:0;flex:1;">
              <strong style="font-size:11px;${premium ? "color:#8a6800;" : ""}">
                ${escapeHTML(profile.username || "Player")}${isMe ? " (you)" : ""}
              </strong>
              <p class="muted" style="font-size:9px;margin-top:1px;">
                ${profile.total_quizzes || 0} quiz${profile.total_quizzes !== 1 ? 'zes' : ''} ${streak > 0 ? "· " + streak + " 🔥" : ""}
              </p>
            </div>
          </div>

          <strong style="font-size:13px;${premium ? "color:#8a6800;" : ""};margin-left:6px;">${rating}</strong>
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