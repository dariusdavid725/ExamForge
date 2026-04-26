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
async function updateStatsForLoggedPlayers(sb, results, hostId, hostProfile) {
  const grouped = new Map();

  results.forEach(result => {
    if (!result.user_id) return;

    const existing = grouped.get(result.user_id) || {
      score: 0,
      quizzes: 0
    };

    existing.score += Number(result.score || 0);
    existing.quizzes += 1;

    grouped.set(result.user_id, existing);
  });

  for (const [userId, stats] of grouped.entries()) {
    try {
      let userProfile = null;

      if (userId === hostId && hostProfile) {
        userProfile = hostProfile;
      } else {
        const { data } = await sb
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        userProfile = data;
      }

      await updateStreakAndStats(sb, userId, userProfile, stats.score);
    } catch (error) {
      console.error("Could not update stats for", userId, error);
    }
  }
}

async function updateStreakAndStats(sb, userId, profile, addedPoints = 0) {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const lastDate = profile?.last_quiz_date;

  let streak = 1;

  if (lastDate === today) {
    streak = profile?.streak_count || 1;
  } else if (lastDate === yesterday) {
    streak = (profile?.streak_count || 0) + 1;
  }

  await sb
    .from("profiles")
    .update({
      streak_count: streak,
      max_streak: Math.max(streak, profile?.max_streak || 0),
      last_quiz_date: today,
      total_quizzes: (profile?.total_quizzes || 0) + 1,
      total_points: (profile?.total_points || 0) + Number(addedPoints || 0)
    })
    .eq("id", userId);
}

// ─── Dashboard render ─────────────────────────────────────────────────────────

export async function renderDashboard(
  container,
  user,
  profile,
  { onCreateArena, onJoinArena, onHistory }
) {
  const sb = await getSupabase();

  const sessions = await getSessionsForUser(sb, user.id, 5);
  const friendProfiles = await getFriendProfiles(sb, user.id);

  const streak = profile?.streak_count || 0;
  const maxStreak = profile?.max_streak || 0;
  const totalQuizzes = profile?.total_quizzes || 0;
  const totalPoints = profile?.total_points || 0;
  const avatarLetter = (profile?.username || user.email || "U")[0].toUpperCase();
  const avatarColor = profile?.avatar_color || "#4f46e5";

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="card dash-profile-card">
        <div class="row" style="align-items:center; gap:16px;">
          <div class="dash-avatar" style="background:${avatarColor};">
            ${escapeHTML(avatarLetter)}
          </div>

          <div>
            <h2>${escapeHTML(profile?.username || "Player")}</h2>
            <p class="muted">${escapeHTML(user.email || "")}</p>
          </div>
        </div>

        <div class="dash-stats-row" style="margin-top:22px;">
          <div class="dash-stat">
            <div class="dash-stat-val">${streak}</div>
            <div class="dash-stat-label">Day streak</div>
          </div>

          <div class="dash-stat">
            <div class="dash-stat-val">${maxStreak}</div>
            <div class="dash-stat-label">Best streak</div>
          </div>

          <div class="dash-stat">
            <div class="dash-stat-val">${totalQuizzes}</div>
            <div class="dash-stat-label">Quizzes</div>
          </div>
        </div>

        <p class="muted" style="margin-top:14px;">
          Total points: ${totalPoints}
        </p>

        <button
          id="logoutBtn"
          class="btn btn-secondary"
          type="button"
          style="margin-top:18px;"
        >
          Logout
        </button>
      </div>

      <div class="card">
        <h2>Quick start</h2>

        <div class="row" style="margin-top:18px;flex-wrap:wrap;">
          <button id="dashCreateBtn" class="btn" type="button">
            ⚡ Create Arena
          </button>

          <button id="dashJoinBtn" class="btn btn-secondary" type="button">
            Join Arena
          </button>

          <a href="/lessons" class="btn btn-secondary" type="button">
            📚 My Lessons
          </a>

          <button id="dashHistoryBtn" class="btn btn-secondary" type="button">
            My History
          </button>
        </div>
      </div>

      <div class="card">
        <h2>Recent quizzes</h2>

        <div style="display:grid; gap:12px; margin-top:16px;">
          ${
            sessions.length > 0
              ? sessions
                  .map(session => renderSessionRow(session, "Details"))
                  .join("")
              : `
                <p class="muted">
                  No quizzes yet. Create your first arena!
                </p>
              `
          }
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h2>Friends leaderboard</h2>

          <button id="addFriendBtn" class="btn btn-secondary" type="button">
            Manage friends
          </button>
        </div>

        <div style="display:grid; gap:10px; margin-top:16px;">
          ${renderFriendsLb(friendProfiles, user.id)}
        </div>
      </div>

      <div
        id="pendingRequestsCard"
        class="card"
        style="display:none;"
      >
        <h2>Friend requests</h2>
        <div
          id="pendingRequestsList"
          style="display:grid; gap:10px; margin-top:16px;"
        ></div>
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

  container.querySelector("#addFriendBtn")?.addEventListener("click", () => {
  showFriendManagerModal(user.id);
});

  container.querySelectorAll("[data-session-id]").forEach(button => {
    button.addEventListener("click", () => {
      showHistoryDetailModal(button.dataset.sessionId, sb);
    });
  });

  await loadPendingRequests(sb, user.id, container);
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
    <button
      class="dash-session-row"
      data-session-id="${session.id}"
      type="button"
    >
      <div style="text-align:left; min-width:0;">
        <strong>${escapeHTML(session.title || "Quiz")}</strong>

        <p class="muted">
          ${escapeHTML(session.category || "Quiz")}
          · ${session.player_count || 0} players
          · ${formatDate(session.played_at)}
        </p>

        ${
          extraLine
            ? `<p class="muted">${escapeHTML(extraLine)}</p>`
            : ""
        }
      </div>

      <span style="font-weight:900; flex-shrink:0;">
        ${escapeHTML(actionText)}
      </span>
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

function renderFriendsLb(profiles, currentUserId) {
  if (!profiles.length) {
    return `
      <p class="muted">Add friends to see the leaderboard!</p>
    `;
  }

  const sorted = [...profiles].sort((a, b) => {
    const ratingA =
      (a.total_points || 0) +
      (a.total_quizzes || 0) * 50 +
      (a.streak_count || 0) * 10;

    const ratingB =
      (b.total_points || 0) +
      (b.total_quizzes || 0) * 50 +
      (b.streak_count || 0) * 10;

    return ratingB - ratingA;
  });

  return sorted
    .map((profile, index) => {
      const rating =
        (profile.total_points || 0) +
        (profile.total_quizzes || 0) * 50 +
        (profile.streak_count || 0) * 10;

      const letter = (profile.username || "U")[0].toUpperCase();
      const color = profile.avatar_color || "#4f46e5";

      return `
        <div class="dash-session-row" style="cursor:default;">
          <div class="row" style="gap:12px; min-width:0;">
            <span class="rank">${index + 1}</span>

            <div
              class="dash-avatar-sm"
              style="background:${color};"
            >
              ${escapeHTML(letter)}
            </div>

            <div style="min-width:0;">
              <strong>
                ${escapeHTML(profile.username || "Player")}
                ${profile.id === currentUserId ? " (you)" : ""}
              </strong>

              <p class="muted">
                ${profile.total_quizzes || 0} quizzes · ${profile.streak_count || 0} streak
              </p>
            </div>
          </div>

          <strong>${rating}</strong>
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