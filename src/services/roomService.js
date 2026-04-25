import { createClient } from "@supabase/supabase-js";
import {
  QUESTION_TIME_SECONDS,
  RESULT_DURATION_SECONDS,
  LEADERBOARD_DURATION_SECONDS,
  EXTRA_RESULTS_BUFFER_MS
} from "../config/constants.js";
import { createTextHash } from "../utils/textUtils.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function generatePlayerId() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

function getCycleMs() {
  return (
    QUESTION_TIME_SECONDS +
    RESULT_DURATION_SECONDS +
    LEADERBOARD_DURATION_SECONDS
  ) * 1000;
}

function getCurrentChallengeIndex(room) {
  if (!room?.started_at || !room?.pack?.challenges?.length) {
    return 0;
  }

  const elapsed = Date.now() - Number(room.started_at);
  const cycleMs = getCycleMs();

  return Math.min(
    Math.floor(elapsed / cycleMs),
    room.pack.challenges.length - 1
  );
}

function normalizePlayer(p) {
  return {
    id: p.id,
    userId: p.user_id || null,
    name: p.name,
    score: p.score,
    correct: p.correct,
    totalAnswered: p.total_answered,
    finished: p.finished,
    answers: p.answers || [],
    weakConcepts: p.weak_concepts || []
  };
}

export async function getRoom(code) {
  const upperCode = String(code || "").toUpperCase();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", upperCode)
    .single();

  if (!room) return null;

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_code", upperCode);

  return {
    ...room,
    players: (players || []).map(normalizePlayer)
  };
}

export async function createRoom(pack) {
  let code = generateRoomCode();

  while (true) {
    const { data } = await supabase
      .from("rooms")
      .select("code")
      .eq("code", code)
      .maybeSingle();

    if (!data) break;

    code = generateRoomCode();
  }

  const room = {
    code,
    pack,
    status: "lobby",
    created_at: Date.now(),
    started_at: null,
    ends_at: null,
    question_time: QUESTION_TIME_SECONDS,
    room_hash: createTextHash(JSON.stringify(pack), code)
  };

  const { error } = await supabase.from("rooms").insert(room);

  if (error) {
    throw new Error(`Failed to create room: ${error.message}`);
  }

  return {
    ...room,
    players: []
  };
}

export async function addPlayerToRoom(roomCode, name, userId = null) {
  const player = {
    id: generatePlayerId(),
    user_id: userId || null,
    room_code: roomCode.toUpperCase(),
    name,
    score: 0,
    correct: 0,
    total_answered: 0,
    finished: false,
    answers: [],
    weak_concepts: []
  };

  const { error } = await supabase.from("players").insert(player);

  if (error) {
    throw new Error(`Failed to add player: ${error.message}`);
  }

  return normalizePlayer(player);
}

export async function startRoom(code) {
  const upperCode = code.toUpperCase();
  const now = Date.now();

  const { data: room } = await supabase
    .from("rooms")
    .select("pack")
    .eq("code", upperCode)
    .single();

  if (!room) {
    throw new Error("Room not found");
  }

  const cycleMs = getCycleMs();

  const endsAt =
    now +
    room.pack.challenges.length * cycleMs +
    EXTRA_RESULTS_BUFFER_MS;

  const { error } = await supabase
    .from("rooms")
    .update({
      status: "started",
      started_at: now,
      ends_at: endsAt,
      question_time: QUESTION_TIME_SECONDS
    })
    .eq("code", upperCode);

  if (error) {
    throw new Error(`Failed to start room: ${error.message}`);
  }

  return {
    status: "started",
    startedAt: now,
    endsAt,
    questionTime: QUESTION_TIME_SECONDS
  };
}

export async function getPlayer(playerId) {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  return data || null;
}

export async function updatePlayer(playerId, updates) {
  const { error } = await supabase
    .from("players")
    .update(updates)
    .eq("id", playerId);

  if (error) {
    throw new Error(`Failed to update player: ${error.message}`);
  }
}

export async function fastForwardToResultIfAllAnswered(roomCode, challengeIndex) {
  const room = await getRoom(roomCode);

  if (!room || room.status !== "started") {
    return null;
  }

  if (!room.pack?.challenges?.length || !room.started_at) {
    return null;
  }

  const totalChallenges = room.pack.challenges.length;

  if (challengeIndex >= totalChallenges - 1) {
    return null;
  }

  const allAnswered =
    room.players.length > 0 &&
    room.players.every(player => {
      return (player.answers || []).some(answer => {
        return Number(answer.challengeIndex) === Number(challengeIndex);
      });
    });

  if (!allAnswered) {
    return null;
  }

  const cycleMs = getCycleMs();
  const now = Date.now();

  const resultPositionMs =
    challengeIndex * cycleMs +
    QUESTION_TIME_SECONDS * 1000;

  const newStartedAt = now - resultPositionMs;

  const newEndsAt =
    newStartedAt +
    totalChallenges * cycleMs +
    EXTRA_RESULTS_BUFFER_MS;

  const { error } = await supabase
    .from("rooms")
    .update({
      started_at: newStartedAt,
      ends_at: newEndsAt
    })
    .eq("code", room.code);

  if (error) {
    throw new Error(`Failed to fast-forward room: ${error.message}`);
  }

  return {
    startedAt: newStartedAt,
    endsAt: newEndsAt
  };
}

export async function forceNextForSinglePlayer(roomCode, playerId) {
  const room = await getRoom(roomCode);

  if (!room) {
    throw new Error("Camera nu există.");
  }

  if (room.status !== "started") {
    throw new Error("Arena nu este pornită.");
  }

  if (room.players.length !== 1) {
    throw new Error("Next manual este permis doar când există un singur player.");
  }

  const player = room.players[0];

  if (player.id !== playerId) {
    throw new Error("Player invalid.");
  }

  const currentIndex = getCurrentChallengeIndex(room);

  const answeredCurrent = (player.answers || []).some(answer => {
    return Number(answer.challengeIndex) === Number(currentIndex);
  });

  if (!answeredCurrent) {
    throw new Error("Răspunde întâi la întrebarea curentă.");
  }

  const totalChallenges = room.pack.challenges.length;

  if (currentIndex >= totalChallenges - 1) {
    const now = Date.now();

    const { error } = await supabase
      .from("rooms")
      .update({
        status: "finished",
        ends_at: now
      })
      .eq("code", room.code);

    if (error) {
      throw new Error(`Failed to finish room: ${error.message}`);
    }

    return {
      finished: true,
      currentChallengeIndex: currentIndex,
      startedAt: room.started_at,
      endsAt: now
    };
  }

  const nextIndex = currentIndex + 1;
  const cycleMs = getCycleMs();
  const now = Date.now();

  const newStartedAt = now - nextIndex * cycleMs;

  const newEndsAt =
    newStartedAt +
    totalChallenges * cycleMs +
    EXTRA_RESULTS_BUFFER_MS;

  const { error } = await supabase
    .from("rooms")
    .update({
      started_at: newStartedAt,
      ends_at: newEndsAt
    })
    .eq("code", room.code);

  if (error) {
    throw new Error(`Failed to go next: ${error.message}`);
  }

  return {
    finished: false,
    currentChallengeIndex: nextIndex,
    startedAt: newStartedAt,
    endsAt: newEndsAt
  };
}

export async function finishRoomIfAllDone(roomCode) {
  const upperCode = roomCode.toUpperCase();

  const { data: players } = await supabase
    .from("players")
    .select("finished")
    .eq("room_code", upperCode);

  if (players && players.length > 0 && players.every(p => p.finished)) {
    await supabase
      .from("rooms")
      .update({
        status: "finished",
        ends_at: Date.now()
      })
      .eq("code", upperCode);
  }
}