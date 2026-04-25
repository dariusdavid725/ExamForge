import { getSupabase } from "./supabaseClient.js";
import { logout } from "./auth.js";
import { showHistoryDetailModal } from "./historyDetail.js";

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
    const sb = await getSupabase();

    const { data: existingSession } = await sb
      .from("game_sessions")
      .select("id")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (existingSession) {
      return existingSession.id;
    }

    const { data: session, error: sessionError } = await sb
      .from("game_sessions")
      .insert({
        host_id: user.id,
        room_code: roomCode,
        title: pack.title,
        category: pack.category || "General Knowledge",
        challenge_count: pack.challenges?.length || 0,
        document_name: documentName || "document",
        document_text: documentText || null,
        document_preview: documentText ? documentText.slice(0, 1500) : null,
        pack,
        conspect: pack.conspect || null,
        player_count: leaderboardData.leaderboard?.length || 0
      })
      .select()
      .single();

    if (sessionError) {
      console.error("game_sessions insert error:", sessionError);
      return null;
    }

    if (!session) return null;

    const results = (leaderboardData.leaderboard || []).map(player => ({
      session_id: session.id,
      user_id: player.userId || (player.id === user.id ? user.id : null),
      player_name: player.name,
      score: player.score,
      correct_count: player.correct,
      total_answered: player.totalAnswered,
      rank: player.rank,
      weak_concepts: player.weakConcepts || [],
      answers: player.answers || []
    }));

    if (results.length > 0) {
      const { error: resultsError } = await sb
        .from("game_results")
        .insert(results);

      if (resultsError) {
        console.error("game_results insert error:", resultsError);
      }
    }

    await updateStatsForLoggedPlayers(sb, results, user.id, profile);

    return session.id;
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

      await updateStreak(sb, userId, userProfile, stats.score);
    } catch (error) {
      console.error("Could not update stats for", userId, error);
    }
  }
}

async function updateStreak(sb, userId, profile, addedPoints = 0) {
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

  const { data: friendships } = await sb
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted");

  const friendIds = (friendships || []).map(friendship =>
    friendship.requester_id === user.id
      ? friendship.addressee_id
      : friendship.requester_id
  );

  friendIds.push(user.id);

  const { data: friendProfiles } = await sb
    .from("profiles")
    .select("*")
    .in("id", friendIds);

  const streak = profile?.streak_count || 0;
  const maxStreak = profile?.max_streak || 0;
  const totalQuizzes = profile?.total_quizzes || 0;
  const avatarLetter = (profile?.username || user.email || "U")[0].toUpperCase();
  const avatarColor = profile?.avatar_color || "#4f46e5";

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="card profile-card">
        <div class="profile-avatar" style="background:${avatarColor}">
          ${escapeHTML(avatarLetter)}
        </div>

        <h2>${escapeHTML(profile?.username || "Player")}</h2>
        <p class="muted">${escapeHTML(user.email || "")}</p>

        <button id="logoutBtn" class="btn btn-secondary" type="button">
          Logout
        </button>
      </div>

      <div class="stat-card">
        <strong>${streak}</strong>
        <span>Day streak</span>
      </div>

      <div class="stat-card">
        <strong>${maxStreak}</strong>
        <span>Best streak</span>
      </div>

      <div class="stat-card">
        <strong>${totalQuizzes}</strong>
        <span>Quizzes played</span>
      </div>

      <div class="card wide-card">
        <h2>Quick start</h2>

        <div class="row" style="margin-top:16px;">
          <button id="dashCreateBtn" class="btn" type="button">
            ⚡ Create Arena
          </button>

          <button id="dashJoinBtn" class="btn btn-secondary" type="button">
            Join Arena
          </button>

          <button id="dashHistoryBtn" class="btn btn-secondary" type="button">
            My History
          </button>
        </div>
      </div>

      <div class="card wide-card">
        <h2>Recent quizzes</h2>

        <div style="display:grid; gap:12px; margin-top:14px;">
          ${
            sessions.length > 0
              ? sessions
                  .map(session => {
                    return `
                      <button
                        class="dash-session-row"
                        data-session-id="${session.id}"
                        type="button"
                      >
                        <div>
                          <strong>${escapeHTML(session.title || "Quiz")}</strong>
                          <p class="muted">
                            ${escapeHTML(session.category || "")}
                            · ${session.player_count || 0} players
                            · ${formatDate(session.played_at)}
                          </p>
                        </div>

                        <span>Details</span>
                      </button>
                    `;
                  })
                  .join("")
              : `
                <p class="muted">
                  No quizzes yet. Create your first arena!
                </p>
              `
          }
        </div>
      </div>

      <div class="card wide-card">
        <div class="row" style="justify-content:space-between;">
          <h2>Friends leaderboard</h2>

          <button id="addFriendBtn" class="btn btn-secondary" type="button">
            + Add friend
          </button>
        </div>

        <div style="display:grid; gap:10px; margin-top:14px;">
          ${renderFriendsLb(friendProfiles || [], user.id)}
        </div>
      </div>

      <div id="pendingRequestsCard" class="card wide-card" style="display:none;">
        <h2>Friend requests</h2>
        <div id="pendingRequestsList" style="display:grid; gap:10px; margin-top:14px;"></div>
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
    showAddFriendModal(sb, user.id);
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
    <div style="display:grid; gap:14px;">
      ${sessions
        .map(session => {
          const myResult = (session.game_results || []).find(result => {
            return result.user_id === user.id;
          });

          return `
            <button
              class="dash-session-row"
              data-history-session-id="${session.id}"
              type="button"
            >
              <div>
                <strong>${escapeHTML(session.title || "Quiz")}</strong>
                <p class="muted">
                  ${escapeHTML(session.category || "Quiz")}
                  · ${session.player_count || 0} players
                  · ${formatDate(session.played_at)}
                </p>

                ${
                  myResult
                    ? `
                      <p class="muted">
                        Your result: #${myResult.rank}
                        · ${myResult.score} pts
                        · ${myResult.correct_count}/${myResult.total_answered} correct
                      </p>
                    `
                    : `
                      <p class="muted">
                        Hosted by you
                      </p>
                    `
                }
              </div>

              <span>Details</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  container.querySelectorAll("[data-history-session-id]").forEach(button => {
    button.addEventListener("click", () => {
      showHistoryDetailModal(button.dataset.historySessionId, sb);
    });
  });
}

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

      return `
        <div class="friend-row">
          <span class="rank">${index + 1}</span>

          <div class="mini-avatar">
            ${escapeHTML((profile.username || "U")[0].toUpperCase())}
          </div>

          <div>
            <strong>
              ${escapeHTML(profile.username || "Player")}
              ${profile.id === currentUserId ? " (you)" : ""}
            </strong>

            <p class="muted">
              ${profile.total_quizzes || 0} quizzes · ${profile.streak_count || 0} streak
            </p>
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
        <div class="friend-row">
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