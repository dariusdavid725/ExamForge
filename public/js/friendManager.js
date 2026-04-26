import { getSupabase } from "./supabaseClient.js";
import { showToast, showConfirm } from "./uiFeedback.js";

export async function showFriendManagerModal(currentUserId) {
  if (!currentUserId) return;

  injectFriendManagerStyles();

  const sb = await getSupabase();

  const overlay = document.createElement("div");
  overlay.className = "ef-friends-overlay";

  overlay.innerHTML = `
    <div class="ef-friends-modal card">
      <div class="row" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <p class="eyebrow">Social</p>
          <h2 style="margin-top:10px;">Manage friends</h2>
          <p class="muted" style="margin-top:6px;">
            Adaugă, acceptă, respinge sau șterge prieteni.
          </p>
        </div>

        <button id="closeFriendManager" class="btn btn-secondary" type="button">
          ✕
        </button>
      </div>

      <div class="ef-add-friend-box">
        <input
          id="friendUsernameInput"
          type="text"
          placeholder="Username..."
          autocomplete="off"
        />

        <button id="sendFriendRequestBtn" class="btn" type="button">
          Send request
        </button>
      </div>

      <div class="ef-friends-tabs">
        <button class="ef-friends-tab active" data-friend-tab="friends" type="button">
          Friends
        </button>

        <button class="ef-friends-tab" data-friend-tab="incoming" type="button">
          Incoming
        </button>

        <button class="ef-friends-tab" data-friend-tab="sent" type="button">
          Sent
        </button>
      </div>

      <div id="friendManagerStatus" class="muted" style="margin-top:14px;">
        Loading...
      </div>

      <div id="friendManagerList" class="ef-friends-list"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  let activeTab = "friends";

  const close = () => overlay.remove();

  overlay.querySelector("#closeFriendManager")?.addEventListener("click", close);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  overlay.querySelectorAll("[data-friend-tab]").forEach(button => {
    button.addEventListener("click", async () => {
      activeTab = button.dataset.friendTab;

      overlay.querySelectorAll("[data-friend-tab]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      await renderTab();
    });
  });

  overlay.querySelector("#sendFriendRequestBtn")?.addEventListener("click", async () => {
    const input = overlay.querySelector("#friendUsernameInput");
    const username = input.value.trim();

    if (!username) {
      showToast("Scrie un username.", "info");
      return;
    }

    await sendFriendRequest(sb, currentUserId, username);
    input.value = "";
    activeTab = "sent";

    overlay.querySelectorAll("[data-friend-tab]").forEach(item => {
      item.classList.toggle("active", item.dataset.friendTab === "sent");
    });

    await renderTab();
  });

  async function renderTab() {
    const list = overlay.querySelector("#friendManagerList");
    const status = overlay.querySelector("#friendManagerStatus");

    list.innerHTML = "";
    status.textContent = "Loading...";

    try {
      if (activeTab === "friends") {
        await renderFriends(sb, currentUserId, list, status, renderTab);
      }

      if (activeTab === "incoming") {
        await renderIncoming(sb, currentUserId, list, status, renderTab);
      }

      if (activeTab === "sent") {
        await renderSent(sb, currentUserId, list, status, renderTab);
      }
    } catch (error) {
      console.error(error);
      status.textContent = error.message || "Could not load friends.";
    }
  }

  await renderTab();
}

async function sendFriendRequest(sb, currentUserId, username) {
  const { data: friend } = await sb
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();

  if (!friend) {
    showToast("User not found.", "danger");
    return;
  }

  if (friend.id === currentUserId) {
    showToast("Asta e contul tău.", "info");
    return;
  }

  const { data: existing } = await sb
    .from("friendships")
    .select("id, status")
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${friend.id}),and(requester_id.eq.${friend.id},addressee_id.eq.${currentUserId})`
    )
    .maybeSingle();

  if (existing) {
    showToast("Există deja o cerere sau sunteți deja prieteni.", "info");
    return;
  }

  const { error } = await sb.from("friendships").insert({
    requester_id: currentUserId,
    addressee_id: friend.id,
    status: "pending"
  });

  if (error) {
    showToast(error.message || "Nu am putut trimite cererea.", "danger");
    return;
  }

  showToast(`Friend request sent to ${friend.username}.`, "success");
}

async function renderFriends(sb, currentUserId, list, status, refresh) {
  const rows = await loadFriendshipRows(sb, currentUserId, "accepted");

  if (!rows.length) {
    status.textContent = "Nu ai încă prieteni acceptați.";
    return;
  }

  status.textContent = `${rows.length} friend${rows.length === 1 ? "" : "s"}`;

  list.innerHTML = rows
    .map(row => renderUserRow({
      id: row.id,
      user: row.otherProfile,
      meta: `${row.otherProfile?.total_quizzes || 0} quizzes · ${row.otherProfile?.streak_count || 0} streak`,
      actions: `
        <button class="btn btn-secondary" data-remove-friend="${row.id}" type="button">
          Remove
        </button>
      `
    }))
    .join("");

  list.querySelectorAll("[data-remove-friend]").forEach(button => {
    button.addEventListener("click", async () => {
      const ok = await showConfirm({
        title: "Remove friend?",
        message: "Prietenul va fi scos din lista ta. Puteți trimite cerere din nou mai târziu.",
        confirmText: "Remove",
        cancelText: "Cancel",
        danger: true
      });

      if (!ok) return;

      const { error } = await sb
        .from("friendships")
        .delete()
        .eq("id", button.dataset.removeFriend);

      if (error) {
        showToast(error.message || "Nu am putut șterge prietenul.", "danger");
        return;
      }

      showToast("Friend removed.", "success");
      await refresh();
    });
  });
}

async function renderIncoming(sb, currentUserId, list, status, refresh) {
  const rows = await loadIncomingRows(sb, currentUserId);

  if (!rows.length) {
    status.textContent = "Nu ai cereri primite.";
    return;
  }

  status.textContent = `${rows.length} incoming request${rows.length === 1 ? "" : "s"}`;

  list.innerHTML = rows
    .map(row => renderUserRow({
      id: row.id,
      user: row.requesterProfile,
      meta: "Wants to be your friend",
      actions: `
        <button class="btn" data-accept-request="${row.id}" type="button">
          Accept
        </button>

        <button class="btn btn-secondary" data-reject-request="${row.id}" type="button">
          Reject
        </button>
      `
    }))
    .join("");

  list.querySelectorAll("[data-accept-request]").forEach(button => {
    button.addEventListener("click", async () => {
      const { error } = await sb
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", button.dataset.acceptRequest);

      if (error) {
        showToast(error.message || "Nu am putut accepta cererea.", "danger");
        return;
      }

      showToast("Friend request accepted.", "success");
      await refresh();
    });
  });

  list.querySelectorAll("[data-reject-request]").forEach(button => {
    button.addEventListener("click", async () => {
      const { error } = await sb
        .from("friendships")
        .delete()
        .eq("id", button.dataset.rejectRequest);

      if (error) {
        showToast(error.message || "Nu am putut respinge cererea.", "danger");
        return;
      }

      showToast("Friend request rejected.", "success");
      await refresh();
    });
  });
}

async function renderSent(sb, currentUserId, list, status, refresh) {
  const rows = await loadSentRows(sb, currentUserId);

  if (!rows.length) {
    status.textContent = "Nu ai cereri trimise în așteptare.";
    return;
  }

  status.textContent = `${rows.length} sent request${rows.length === 1 ? "" : "s"}`;

  list.innerHTML = rows
    .map(row => renderUserRow({
      id: row.id,
      user: row.addresseeProfile,
      meta: "Pending",
      actions: `
        <button class="btn btn-secondary" data-cancel-request="${row.id}" type="button">
          Cancel
        </button>
      `
    }))
    .join("");

  list.querySelectorAll("[data-cancel-request]").forEach(button => {
    button.addEventListener("click", async () => {
      const { error } = await sb
        .from("friendships")
        .delete()
        .eq("id", button.dataset.cancelRequest);

      if (error) {
        showToast(error.message || "Nu am putut anula cererea.", "danger");
        return;
      }

      showToast("Request cancelled.", "success");
      await refresh();
    });
  });
}

async function loadFriendshipRows(sb, currentUserId, status) {
  const { data: friendships, error } = await sb
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .eq("status", status);

  if (error) throw error;

  const otherIds = (friendships || []).map(row => {
    return row.requester_id === currentUserId
      ? row.addressee_id
      : row.requester_id;
  });

  const profilesById = await loadProfilesById(sb, otherIds);

  return (friendships || []).map(row => {
    const otherId = row.requester_id === currentUserId
      ? row.addressee_id
      : row.requester_id;

    return {
      ...row,
      otherProfile: profilesById.get(otherId)
    };
  });
}

async function loadIncomingRows(sb, currentUserId) {
  const { data: rows, error } = await sb
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("addressee_id", currentUserId)
    .eq("status", "pending");

  if (error) throw error;

  const profilesById = await loadProfilesById(
    sb,
    (rows || []).map(row => row.requester_id)
  );

  return (rows || []).map(row => ({
    ...row,
    requesterProfile: profilesById.get(row.requester_id)
  }));
}

async function loadSentRows(sb, currentUserId) {
  const { data: rows, error } = await sb
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("requester_id", currentUserId)
    .eq("status", "pending");

  if (error) throw error;

  const profilesById = await loadProfilesById(
    sb,
    (rows || []).map(row => row.addressee_id)
  );

  return (rows || []).map(row => ({
    ...row,
    addresseeProfile: profilesById.get(row.addressee_id)
  }));
}

async function loadProfilesById(sb, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const { data: profiles, error } = await sb
    .from("profiles")
    .select("id, username, avatar_color, total_quizzes, streak_count, total_points")
    .in("id", uniqueIds);

  if (error) throw error;

  return new Map((profiles || []).map(profile => [profile.id, profile]));
}

function renderUserRow({ user, meta, actions }) {
  const username = user?.username || "Unknown";
  const letter = username[0]?.toUpperCase() || "U";
  const color = user?.avatar_color || "#4f46e5";

  return `
    <div class="dash-session-row" style="cursor:default;">
      <div class="row" style="gap:12px; min-width:0;">
        <div class="dash-avatar-sm" style="background:${escapeHTML(color)};">
          ${escapeHTML(letter)}
        </div>

        <div style="text-align:left; min-width:0;">
          <strong>${escapeHTML(username)}</strong>
          <p class="muted">${escapeHTML(meta || "")}</p>
        </div>
      </div>

      <div class="row" style="gap:8px; flex-shrink:0;">
        ${actions}
      </div>
    </div>
  `;
}

function injectFriendManagerStyles() {
  if (document.getElementById("ef-friend-manager-styles")) return;

  const style = document.createElement("style");
  style.id = "ef-friend-manager-styles";

  style.textContent = `
    .ef-friends-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.55);
      padding: 28px;
      overflow: auto;
    }

    .ef-friends-modal {
      width: min(880px, calc(100vw - 56px));
      margin: 0 auto;
    }

    .ef-add-friend-box {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      margin-top: 20px;
    }

    .ef-friends-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .ef-friends-tab {
      border: 3px solid var(--text, #111);
      background: var(--paper, #fffaf0);
      color: var(--text, #111);
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 950;
      cursor: pointer;
      box-shadow: 3px 3px 0 var(--text, #111);
    }

    .ef-friends-tab.active {
      background: var(--accent, #facc15);
    }

    .ef-friends-list {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }

    html.ef-dark .ef-friends-tab {
      background: #0f172a;
      color: #f8fafc;
      box-shadow: 3px 3px 0 #f8fafc;
    }

    html.ef-dark .ef-friends-tab.active {
      background: #a78bfa;
      color: #111827;
    }

    @media (max-width: 720px) {
      .ef-friends-overlay {
        padding: 14px;
      }

      .ef-friends-modal {
        width: calc(100vw - 28px);
      }

      .ef-add-friend-box {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}