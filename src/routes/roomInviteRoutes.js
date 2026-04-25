import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getAcceptedFriendIds(userId) {
  const { data, error } = await supabaseAdmin
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");

  if (error) {
    console.error("friends load error:", error);
    return [];
  }

  return (data || []).map(friendship => {
    return friendship.requester_id === userId
      ? friendship.addressee_id
      : friendship.requester_id;
  });
}

async function areFriends(userA, userB) {
  const friendIds = await getAcceptedFriendIds(userA);
  return friendIds.includes(userB);
}

router.get("/friends/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Missing userId."
      });
    }

    const friendIds = await getAcceptedFriendIds(userId);

    if (!friendIds.length) {
      return res.json({
        friends: []
      });
    }

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, avatar_color, total_quizzes, streak_count, total_points")
      .in("id", friendIds);

    if (error) {
      return res.status(500).json({
        error: error.message || "Could not load friends."
      });
    }

    return res.json({
      friends: profiles || []
    });
  } catch (error) {
    console.error("GET friends error:", error);

    return res.status(500).json({
      error: error.message || "Could not load friends."
    });
  }
});

router.post("/room-invites", async (req, res) => {
  try {
    const { roomCode, inviterId, inviteeId } = req.body;

    if (!roomCode || !inviterId || !inviteeId) {
      return res.status(400).json({
        error: "Missing invite data."
      });
    }

    if (inviterId === inviteeId) {
      return res.status(400).json({
        error: "Nu te poți invita singur."
      });
    }

    const upperCode = String(roomCode).toUpperCase();

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("code, status")
      .eq("code", upperCode)
      .maybeSingle();

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({
        error: "Poți invita prieteni doar înainte să înceapă arena."
      });
    }

    const { data: inviterPlayer } = await supabaseAdmin
      .from("players")
      .select("id, user_id, room_code")
      .eq("room_code", upperCode)
      .eq("user_id", inviterId)
      .maybeSingle();

    if (!inviterPlayer) {
      return res.status(403).json({
        error: "Doar un player din lobby poate trimite invitații."
      });
    }

    const friendshipOk = await areFriends(inviterId, inviteeId);

    if (!friendshipOk) {
      return res.status(403).json({
        error: "Poți invita doar prieteni acceptați."
      });
    }

    const { data: existingPlayer } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("room_code", upperCode)
      .eq("user_id", inviteeId)
      .maybeSingle();

    if (existingPlayer) {
      return res.status(400).json({
        error: "Prietenul este deja în lobby."
      });
    }

    const { data: invite, error } = await supabaseAdmin
      .from("room_invites")
      .upsert(
        {
          room_code: upperCode,
          inviter_id: inviterId,
          invitee_id: inviteeId,
          status: "pending",
          responded_at: null
        },
        {
          onConflict: "room_code,invitee_id"
        }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: error.message || "Nu am putut trimite invitația."
      });
    }

    return res.json({
      ok: true,
      invite
    });
  } catch (error) {
    console.error("POST room invite error:", error);

    return res.status(500).json({
      error: error.message || "Nu am putut trimite invitația."
    });
  }
});

router.get("/room-invites/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Missing userId."
      });
    }

    const { data: invites, error } = await supabaseAdmin
      .from("room_invites")
      .select("id, room_code, inviter_id, invitee_id, status, created_at")
      .eq("invitee_id", userId)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        error: error.message || "Could not load invites."
      });
    }

    const inviterIds = [
      ...new Set((invites || []).map(invite => invite.inviter_id))
    ];

    const roomCodes = [
      ...new Set((invites || []).map(invite => invite.room_code))
    ];

    let profilesById = new Map();
    let roomsByCode = new Map();

    if (inviterIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, avatar_color")
        .in("id", inviterIds);

      profilesById = new Map((profiles || []).map(profile => [profile.id, profile]));
    }

    if (roomCodes.length > 0) {
      const { data: rooms } = await supabaseAdmin
        .from("rooms")
        .select("code, status, pack")
        .in("code", roomCodes);

      roomsByCode = new Map((rooms || []).map(room => [room.code, room]));
    }

    const hydrated = (invites || [])
      .map(invite => {
        const room = roomsByCode.get(invite.room_code);
        const inviter = profilesById.get(invite.inviter_id);

        return {
          ...invite,
          inviter,
          roomStatus: room?.status || "unknown",
          roomTitle: room?.pack?.title || "ExamForge Arena",
          roomSummary: room?.pack?.summary || ""
        };
      })
      .filter(invite => invite.roomStatus === "lobby");

    return res.json({
      invites: hydrated
    });
  } catch (error) {
    console.error("GET room invites error:", error);

    return res.status(500).json({
      error: error.message || "Could not load invites."
    });
  }
});

router.post("/room-invites/:inviteId/respond", async (req, res) => {
  try {
    const inviteId = req.params.inviteId;
    const { status } = req.body;

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status."
      });
    }

    const { data: invite, error } = await supabaseAdmin
      .from("room_invites")
      .update({
        status,
        responded_at: new Date().toISOString()
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: error.message || "Could not update invite."
      });
    }

    return res.json({
      ok: true,
      invite
    });
  } catch (error) {
    console.error("respond invite error:", error);

    return res.status(500).json({
      error: error.message || "Could not update invite."
    });
  }
});

export default router;