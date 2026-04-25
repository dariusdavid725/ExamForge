import { getSupabase } from "./supabaseClient.js";
import { logout } from "./auth.js";

// ─── Save completed game ──────────────────────────────────────────────────────

export async function saveGameSession({ user, profile, pack, roomCode, documentName, documentText, leaderboardData }) {
  try {
    const sb = await getSupabase();

    // Save session
    const { data: session } = await sb.from("game_sessions").insert({
      host_id:         user.id,
      room_code:       roomCode,
      title:           pack.title,
      category:        pack.category || "General Knowledge",
      challenge_count: pack.challenges.length,
      document_name:   documentName || "document",
      pack,
      player_count:    leaderboardData.leaderboard.length
    }).select().single();

    if (!session) return;

    // Save results for each player
    const results = leaderboardData.leaderboard.map(p => ({
      session_id:     session.id,
      user_id:        p.id === user.id ? user.id : null,
      player_name:    p.name,
      score:          p.score,
      correct_count:  p.correct,
      total_answered: p.totalAnswered,
      rank:           p.rank
    }));
    await sb.from("game_results").insert(results);

    // Update streak + stats
    await updateStreak(sb, user.id, profile);

    return session.id;
  } catch (err) {
    console.error("saveGameSession error:", err);
  }
}

async function updateStreak(sb, userId, profile) {
  const today     = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const lastDate  = profile?.last_quiz_date;

  let streak = 1;
  if (lastDate === today)      streak = profile.streak_count || 1;
  else if (lastDate === yesterday) streak = (profile.streak_count || 0) + 1;

  await sb.from("profiles").update({
    streak_count:  streak,
    max_streak:    Math.max(streak, profile?.max_streak || 0),
    last_quiz_date: today,
    total_quizzes: (profile?.total_quizzes || 0) + 1
  }).eq("id", userId);
}

// ─── Dashboard render ─────────────────────────────────────────────────────────

export async function renderDashboard(container, user, profile, { onCreateArena, onJoinArena, onHistory }) {
  const sb = await getSupabase();

  // Recent sessions
  const { data: sessions } = await sb
    .from("game_sessions")
    .select("*")
    .eq("host_id", user.id)
    .order("played_at", { ascending: false })
    .limit(5);

  // Friends leaderboard
  const { data: friendships } = await sb
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted");

  const friendIds = (friendships || []).map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );
  friendIds.push(user.id); // include self

  const { data: friendProfiles } = await sb
    .from("profiles")
    .select("*")
    .in("id", friendIds);

  const streak     = profile?.streak_count || 0;
  const maxStreak  = profile?.max_streak   || 0;
  const totalQuizzes = profile?.total_quizzes || 0;

  const avatarLetter = (profile?.username || user.email || "U")[0].toUpperCase();
  const avatarColor  = profile?.avatar_color || "#4f46e5";

  container.innerHTML = `
    <div class="dashboard-grid">

      <!-- Left: Profile + Stats -->
      <div style="display:grid;gap:16px;">
        <div class="card dash-profile-card">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="dash-avatar" style="background:${avatarColor}">${avatarLetter}</div>
            <div>
              <h2 style="margin:0;">${profile?.username || "Player"}</h2>
              <p class="muted" style="font-size:13px;">${user.email}</p>
            </div>
            <button class="btn btn-secondary" style="margin-left:auto;padding:8px 14px;font-size:13px;" id="logoutBtn">Logout</button>
          </div>

          <div class="dash-stats-row" style="margin-top:22px;">
            <div class="dash-stat">
              <div class="dash-stat-val">${streak}<span style="font-size:22px;">🔥</span></div>
              <div class="dash-stat-label">Day streak</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-val">${maxStreak}</div>
              <div class="dash-stat-label">Best streak</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-val">${totalQuizzes}</div>
              <div class="dash-stat-label">Quizzes played</div>
            </div>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="card">
          <div class="eyebrow">Quick start</div>
          <div style="display:grid;gap:12px;margin-top:16px;">
            <button class="btn" id="dashCreateBtn" style="width:100%;">⚡ Create Arena</button>
            <button class="btn btn-secondary" id="dashJoinBtn" style="width:100%;">🎮 Join Arena</button>
            <button class="btn btn-secondary" id="dashHistoryBtn" style="width:100%;">📚 My History</button>
          </div>
        </div>

        <!-- Recent quizzes -->
        <div class="card">
          <div class="eyebrow">Recent quizzes</div>
          <div style="display:grid;gap:10px;margin-top:16px;">
            ${sessions && sessions.length > 0
              ? sessions.map(s => `
                <div class="dash-session-row" data-id="${s.id}">
                  <div>
                    <strong style="font-size:14px;">${s.title || "Quiz"}</strong>
                    <p class="muted" style="font-size:12px;">${s.category || ""} · ${s.player_count} players · ${new Date(s.played_at).toLocaleDateString()}</p>
                  </div>
                  <span class="pill">${s.category || "Quiz"}</span>
                </div>
              `).join("")
              : `<p class="muted" style="font-size:14px;">No quizzes yet. Create your first arena!</p>`
            }
          </div>
        </div>
      </div>

      <!-- Right: Friends leaderboard -->
      <div style="display:grid;gap:16px;align-content:start;">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="eyebrow">Friends leaderboard</div>
            <button class="btn btn-secondary" id="addFriendBtn" style="padding:7px 12px;font-size:12px;">+ Add friend</button>
          </div>
          <div style="display:grid;gap:10px;margin-top:16px;" id="friendsLbList">
            ${renderFriendsLb(friendProfiles || [], user.id)}
          </div>
        </div>

        <div class="card" id="pendingRequestsCard" style="display:none;">
          <div class="eyebrow">Friend requests</div>
          <div id="pendingRequestsList" style="display:grid;gap:10px;margin-top:14px;"></div>
        </div>
      </div>
    </div>
  `;

  container.querySelector("#logoutBtn").addEventListener("click", async () => {
    await logout();
    location.reload();
  });

  container.querySelector("#dashCreateBtn").addEventListener("click", onCreateArena);
  container.querySelector("#dashJoinBtn").addEventListener("click", onJoinArena);
  container.querySelector("#dashHistoryBtn").addEventListener("click", onHistory);

  container.querySelector("#addFriendBtn").addEventListener("click", () => showAddFriendModal(sb, user.id));

  container.querySelectorAll(".dash-session-row").forEach(row => {
    row.addEventListener("click", () => showSessionDetail(row.dataset.id, sb));
  });

  // Load pending friend requests
  await loadPendingRequests(sb, user.id, container);
}

function renderFriendsLb(profiles, currentUserId) {
  if (!profiles.length) return `<p class="muted" style="font-size:14px;">Add friends to see the leaderboard!</p>`;

  const sorted = [...profiles].sort((a, b) => {
    const ratingA = (a.total_points || 0) + (a.total_quizzes || 0) * 50 + (a.streak_count || 0) * 10;
    const ratingB = (b.total_points || 0) + (b.total_quizzes || 0) * 50 + (b.streak_count || 0) * 10;
    return ratingB - ratingA;
  });

  return sorted.map((p, i) => `
    <div class="mini-lb-row ${i === 0 ? "mini-lb-first" : ""}" style="animation:none;">
      <span class="mini-lb-rank">${i + 1}</span>
      <div class="dash-avatar-sm" style="background:${p.avatar_color || "#4f46e5"}">${(p.username || "U")[0].toUpperCase()}</div>
      <div style="flex:1;">
        <strong style="font-size:14px;">${p.username}${p.id === currentUserId ? " (you)" : ""}</strong>
        <p class="muted" style="font-size:11px;">${p.total_quizzes || 0} quizzes · ${p.streak_count || 0}🔥</p>
      </div>
      <span class="mini-lb-score">${(p.total_points || 0) + (p.total_quizzes || 0) * 50 + (p.streak_count || 0) * 10}</span>
    </div>
  `).join("");
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
  card.style.display = "";

  list.innerHTML = requests.map(r => `
    <div style="display:flex;align-items:center;gap:10px;">
      <strong style="flex:1;">${r.profiles?.username || "Unknown"}</strong>
      <button class="btn" style="padding:7px 12px;font-size:12px;" onclick="acceptFriend('${r.id}', '${r.requester_id}')">Accept</button>
      <button class="btn btn-secondary" style="padding:7px 12px;font-size:12px;" onclick="rejectFriend('${r.id}')">Reject</button>
    </div>
  `).join("");

  // Expose globally for inline onclick
  window.acceptFriend = async (reqId, requesterId) => {
    await sb.from("friendships").update({ status: "accepted" }).eq("id", reqId);
    card.style.display = "none";
    location.reload();
  };
  window.rejectFriend = async (reqId) => {
    await sb.from("friendships").update({ status: "rejected" }).eq("id", reqId);
    location.reload();
  };
}

async function showAddFriendModal(sb, userId) {
  const username = prompt("Enter friend's username:");
  if (!username) return;

  const { data: friend } = await sb.from("profiles").select("id, username").eq("username", username.trim()).maybeSingle();
  if (!friend) { alert("User not found."); return; }
  if (friend.id === userId) { alert("That's you!"); return; }

  const { error } = await sb.from("friendships").insert({
    requester_id: userId,
    addressee_id: friend.id,
    status: "pending"
  });

  if (error) { alert("Already sent or already friends."); return; }
  alert(`Friend request sent to ${friend.username}!`);
}

async function showSessionDetail(sessionId, sb) {
  const { data: session } = await sb.from("game_sessions").select("*").eq("id", sessionId).single();
  const { data: results  } = await sb.from("game_results").select("*").eq("session_id", sessionId).order("rank");

  if (!session) return;

  const modal = document.createElement("div");
  modal.className = "session-modal-overlay";
  modal.innerHTML = `
    <div class="session-modal card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;">${session.title}</h2>
        <button class="btn btn-secondary" id="closeModal" style="padding:8px 14px;">✕</button>
      </div>
      <p class="muted">${session.category} · ${session.player_count} players · ${new Date(session.played_at).toLocaleDateString()}</p>

      <div class="eyebrow" style="margin-top:20px;">Results</div>
      <div style="display:grid;gap:10px;margin-top:12px;">
        ${(results || []).map(r => `
          <div class="leader-row">
            <div style="display:flex;gap:12px;align-items:center;">
              <div class="rank">${r.rank}</div>
              <div>
                <strong>${r.player_name}</strong>
                <p class="muted" style="font-size:12px;">${r.correct_count}/${r.total_answered} correct</p>
              </div>
            </div>
            <strong>${r.score} pts</strong>
          </div>
        `).join("")}
      </div>

      ${session.conspect ? `
        <div class="eyebrow" style="margin-top:20px;">Study notes</div>
        <div class="flat-card" style="margin-top:12px;">
          <p>${JSON.stringify(session.conspect).slice(0, 200)}...</p>
        </div>
      ` : ""}
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#closeModal").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
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
