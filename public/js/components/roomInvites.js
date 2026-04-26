import * as api from "./api.js";

export async function showInviteFriendsModal({ roomCode, currentUser }) {
  if (!roomCode || !currentUser?.id) return;

  injectInviteStyles();

  const overlay = document.createElement("div");
  overlay.className = "ef-invite-overlay";

  overlay.innerHTML = `
    <div class="ef-invite-modal card">
      <div class="row" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <p class="eyebrow">Arena invite</p>
          <h2 style="margin-top:10px;">Invite friends</h2>
          <p class="muted" style="margin-top:6px;">
            Send direct invites for room ${escapeHTML(roomCode)}.
          </p>
        </div>

        <button id="closeInviteModal" class="btn btn-secondary" type="button">
          ✕
        </button>
      </div>

      <div id="inviteFriendsList" style="display:grid; gap:12px; margin-top:18px;">
        <p class="muted">Loading friends...</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#closeInviteModal")?.addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  const list = overlay.querySelector("#inviteFriendsList");

  try {
    const { response, data } = await api.fetchFriends(currentUser.id);

    if (!response.ok) {
      throw new Error(data.error || "Could not load friends.");
    }

    const friends = data.friends || [];

    if (!friends.length) {
      list.innerHTML = `
        <div class="flat-card">
          <p class="muted">
            You have no accepted friends yet. Add friends from the dashboard first.
          </p>
        </div>
      `;
      return;
    }

    list.innerHTML = friends
      .map(friend => {
        const letter = (friend.username || "U")[0].toUpperCase();
        const color = friend.avatar_color || "#4f46e5";

        return `
          <div class="dash-session-row" style="cursor:default;">
            <div class="row" style="gap:12px; min-width:0;">
              <div class="dash-avatar-sm" style="background:${escapeHTML(color)};">
                ${escapeHTML(letter)}
              </div>

              <div style="min-width:0; text-align:left;">
                <strong>${escapeHTML(friend.username || "Player")}</strong>
                <p class="muted">
                  ${friend.total_quizzes || 0} quizzes · ${friend.streak_count || 0} streak
                </p>
              </div>
            </div>

            <button
              class="btn btn-secondary"
              type="button"
              data-invite-friend="${friend.id}"
            >
              Invite
            </button>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-invite-friend]").forEach(button => {
      button.addEventListener("click", async () => {
        const inviteeId = button.dataset.inviteFriend;

        button.disabled = true;
        button.textContent = "Sending...";

        try {
          const { response, data } = await api.sendRoomInvite(
            roomCode,
            currentUser.id,
            inviteeId
          );

          if (!response.ok) {
            throw new Error(data.error || "Could not send invite.");
          }

          button.textContent = "Invited";
        } catch (error) {
          button.disabled = false;
          button.textContent = "Invite";
          alert(error.message || "Could not send invite.");
        }
      });
    });
  } catch (error) {
    list.innerHTML = `
      <div class="flat-card">
        <p class="muted">${escapeHTML(error.message || "Could not load friends.")}</p>
      </div>
    `;
  }
}

export async function renderRoomInvitesCard(container, currentUser, onJoinInvite) {
  if (!container || !currentUser?.id) return;

  document.getElementById("roomInvitesCard")?.remove();

  const { response, data } = await api.fetchRoomInvites(currentUser.id);

  if (!response.ok) return;

  const invites = data.invites || [];

  if (!invites.length) return;

  const grid = container.querySelector(".dashboard-grid") || container;

  const card = document.createElement("div");
  card.id = "roomInvitesCard";
  card.className = "card";

  card.innerHTML = `
    <h2>Arena invites</h2>
    <p class="muted" style="margin-top:8px;">
      Your friends have invited you to active lobbies.
    </p>

    <div style="display:grid; gap:12px; margin-top:16px;">
      ${invites
        .map(invite => {
          const inviterName = invite.inviter?.username || "A friend";

          return `
            <div class="dash-session-row" style="cursor:default;">
              <div style="text-align:left; min-width:0;">
                <strong>${escapeHTML(invite.roomTitle || "ExamForge Arena")}</strong>
                <p class="muted">
                  Invited by ${escapeHTML(inviterName)}
                  · Room ${escapeHTML(invite.room_code)}
                </p>
              </div>

              <div class="row" style="gap:8px; flex-shrink:0;">
                <button
                  class="btn"
                  type="button"
                  data-join-room-invite="${invite.id}"
                  data-room-code="${invite.room_code}"
                >
                  Join
                </button>

                <button
                  class="btn btn-secondary"
                  type="button"
                  data-decline-room-invite="${invite.id}"
                >
                  Decline
                </button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  grid.prepend(card);

  card.querySelectorAll("[data-join-room-invite]").forEach(button => {
    button.addEventListener("click", async () => {
      const inviteId = button.dataset.joinRoomInvite;
      const roomCode = button.dataset.roomCode;

      button.disabled = true;
      button.textContent = "Joining...";

      try {
        await onJoinInvite({
          id: inviteId,
          room_code: roomCode
        });
      } catch (error) {
        button.disabled = false;
        button.textContent = "Join";
        alert(error.message || "Could not join invite.");
      }
    });
  });

  card.querySelectorAll("[data-decline-room-invite]").forEach(button => {
    button.addEventListener("click", async () => {
      const inviteId = button.dataset.declineRoomInvite;

      button.disabled = true;
      button.textContent = "Declining...";

      try {
        await api.respondRoomInvite(inviteId, "declined");
        button.closest(".dash-session-row")?.remove();

        if (!card.querySelector(".dash-session-row")) {
          card.remove();
        }
      } catch {
        button.disabled = false;
        button.textContent = "Decline";
      }
    });
  });
}

function injectInviteStyles() {
  if (document.getElementById("ef-invite-styles")) return;

  const style = document.createElement("style");
  style.id = "ef-invite-styles";

  style.textContent = `
    .ef-invite-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.55);
      padding: 28px;
      overflow: auto;
    }

    .ef-invite-modal {
      max-width: 760px;
      width: min(760px, calc(100vw - 56px));
      margin: 0 auto;
    }

    @media (max-width: 720px) {
      .ef-invite-overlay {
        padding: 14px;
      }

      .ef-invite-modal {
        width: calc(100vw - 28px);
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