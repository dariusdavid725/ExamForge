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

  const sessions = await getSessionsForUser(sb, user.id, 5);
  const friendProfiles = await getFriendProfiles(sb, user.id);

  const streak      = profile?.streak_count  || 0;
  const maxStreak   = profile?.max_streak    || 0;
  const totalQuizzes = profile?.total_quizzes || 0;
  const totalPoints  = profile?.total_points  || 0;
  const avatarLetter = (profile?.username || user.email || "U")[0].toUpperCase();
  const avatarColor  = profile?.avatar_color  || "#4f46e5";
  const isPremium    = (profile?.plan || "free") === "premium";

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="card dash-profile-card">

        <div class="row" style="align-items:center;gap:14px;">
          <!-- Avatar with optional crown -->
          <div style="position:relative;flex-shrink:0;">
            ${isPremium ? `<span style="position:absolute;top:-15px;left:50%;transform:translateX(-50%);
              font-size:18px;line-height:1;z-index:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.25));">👑</span>` : ""}
            <div class="dash-avatar" style="background:${avatarColor};">
              ${escapeHTML(avatarLetter)}
            </div>
          </div>

          <div style="min-width:0;">
            <h2 style="font-size:20px;letter-spacing:-.03em;">${escapeHTML(profile?.username || "Player")}</h2>
            <p class="muted" style="font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHTML(user.email || "")}
            </p>
            ${isPremium ? `<span style="display:inline-block;margin-top:5px;background:#c9a227;color:white;
              font-size:10px;font-weight:900;padding:2px 9px;border-radius:999px;border:2px solid var(--text);
              letter-spacing:.05em;">⭐ PREMIUM</span>` : ""}
          </div>
        </div>

        <div class="dash-stats-row" style="margin-top:14px;">
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
            <div class="dash-stat-label">Quizzes</div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat-val">${totalPoints}</div>
            <div class="dash-stat-label">Points</div>
          </div>
        </div>

        <button
          id="logoutBtn"
          class="btn btn-secondary"
          type="button"
          style="margin-top:14px;padding:9px 18px;font-size:14px;"
        >
          Logout
        </button>
      </div>

      <div class="card">
        <h2 style="font-size:20px;">Quick start</h2>

        <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px;">
          <button id="dashCreateBtn" class="btn" type="button" style="padding:10px 16px;font-size:14px;">
            ⚡ Create Arena
          </button>
          <button id="dashJoinBtn" class="btn btn-secondary" type="button" style="padding:10px 16px;font-size:14px;">
            Join Arena
          </button>
          <a href="/lessons" class="btn btn-secondary" type="button" style="padding:10px 16px;font-size:14px;">
            📚 My Lessons
          </a>
          <button id="dashHistoryBtn" class="btn btn-secondary" type="button" style="padding:10px 16px;font-size:14px;">
            My History
          </button>
        </div>
      </div>

      <div class="card">
        <h2 style="font-size:20px;">Recent quizzes</h2>

        <div style="display:grid;gap:8px;margin-top:12px;">
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
        <div class="row" style="justify-content:space-between;align-items:center;">
          <h2 style="font-size:20px;">Friends leaderboard</h2>
          <button id="addFriendBtn" class="btn btn-secondary" type="button" style="padding:8px 14px;font-size:13px;">
            Manage friends
          </button>
        </div>

        <div style="display:grid;gap:8px;margin-top:12px;">
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
  await renderPlanCard(container, user.id);
}

// ─── Plan / Subscription card ─────────────────────────────────────────────────

async function renderPlanCard(container, userId) {
  try {
    const res  = await fetch(`/api/stripe/plan-status?userId=${userId}`);
    if (!res.ok) return;
    const data = await res.json();

    const grid = container.querySelector(".dashboard-grid");
    if (!grid) return;

    const card = document.createElement("div");
    card.className = "card";

    if (data.plan === "premium") {
      card.innerHTML = `
        <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="eyebrow">Abonament</div>
            <h2 style="margin-top:8px;">
              <span style="background:var(--blue);color:white;padding:4px 14px;border-radius:999px;
                           font-size:15px;border:2px solid var(--text);">⭐ Premium</span>
            </h2>
            <p class="muted" style="margin-top:8px;">Lectii si arene nelimitate, quiz-uri si rapoarte.</p>
          </div>
          <button id="manageSubBtn" class="btn btn-secondary" type="button">Gestioneaza abonamentul</button>
        </div>`;

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
      const lessonsLeft = Math.max(0, 3 - (data.weeklyLessonsUsed || 0));
      const quizzesLeft = Math.max(0, 3 - (data.weeklyQuizzesUsed || 0));

      card.innerHTML = `
        <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="eyebrow">Abonament</div>
            <h2 style="margin-top:8px;">
              <span style="background:var(--paper-2);padding:4px 14px;border-radius:999px;
                           font-size:15px;border:2px solid var(--text);">Free</span>
            </h2>
            <div style="margin-top:14px;display:grid;gap:8px;">
              <div style="font-size:14px;">
                Lectii: <strong>${data.weeklyLessonsUsed || 0}/3</strong> folosite saptamana aceasta
                <div class="progress-track" style="margin-top:4px;">
                  <div class="progress-fill" style="width:${Math.min(100, ((data.weeklyLessonsUsed||0)/3)*100)}%;
                       background:${lessonsLeft===0?"var(--red)":"var(--blue)"};"></div>
                </div>
              </div>
              <div style="font-size:14px;">
                Arene: <strong>${data.weeklyQuizzesUsed || 0}/3</strong> folosite saptamana aceasta
                <div class="progress-track" style="margin-top:4px;">
                  <div class="progress-fill" style="width:${Math.min(100, ((data.weeklyQuizzesUsed||0)/3)*100)}%;
                       background:${quizzesLeft===0?"var(--red)":"var(--blue)"};"></div>
                </div>
              </div>
            </div>
          </div>
          <a href="/pricing" class="btn" style="white-space:nowrap;">Upgrade &mdash; €5/luna</a>
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:2px solid var(--text);">
          <p class="muted" style="font-size:13px;">
            Premium include: lectii nelimitate, arene nelimitate, quiz-uri la lectii, rapoarte de performanta.
          </p>
        </div>`;
    }

    const profileCard = grid.querySelector(".dash-profile-card");
    if (profileCard) profileCard.after(card);
    else grid.appendChild(card);
  } catch { /* silent */ }
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