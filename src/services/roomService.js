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

export function getCycleMs() {
  return (
    QUESTION_TIME_SECONDS +
    RESULT_DURATION_SECONDS +
    LEADERBOARD_DURATION_SECONDS
  ) * 1000;
}

function normalizePlayer(player) {
  return {
    id: player.id,
    userId: player.user_id || null,
    name: player.name,
    score: player.score,
    correct: player.correct,
    totalAnswered: player.total_answered,
    finished: player.finished,
    answers: player.answers || [],
    weakConcepts: player.weak_concepts || []
  };
}

export function getRoomTiming(room, serverNow = Date.now()) {
  const totalChallenges = room?.pack?.challenges?.length || 0;
  const questionTime = Number(room?.question_time || QUESTION_TIME_SECONDS);
  const resultDuration = RESULT_DURATION_SECONDS;
  const leaderboardDuration = LEADERBOARD_DURATION_SECONDS;
  const cycleMs = (questionTime + resultDuration + leaderboardDuration) * 1000;

  if (!room || room.status === "lobby" || !room.started_at || totalChallenges === 0) {
    return {
      serverNow,
      phase: "lobby",
      currentChallengeIndex: 0,
      timeLeft: questionTime,
      cycleMs,
      questionTime,
      resultDuration,
      leaderboardDuration,
      totalChallenges
    };
  }

  if (room.status === "finished") {
    return {
      serverNow,
      phase: "done",
      currentChallengeIndex: Math.max(0, totalChallenges - 1),
      timeLeft: 0,
      cycleMs,
      questionTime,
      resultDuration,
      leaderboardDuration,
      totalChallenges
    };
  }

  const elapsed = Math.max(0, serverNow - Number(room.started_at));
  const totalDuration = totalChallenges * cycleMs;

  if (elapsed >= totalDuration) {
    return {
      serverNow,
      phase: "done",
      currentChallengeIndex: Math.max(0, totalChallenges - 1),
      timeLeft: 0,
      cycleMs,
      questionTime,
      resultDuration,
      leaderboardDuration,
      totalChallenges
    };
  }

  const currentChallengeIndex = Math.min(
    Math.floor(elapsed / cycleMs),
    totalChallenges - 1
  );

  const timeInCycle = elapsed % cycleMs;
  const questionMs = questionTime * 1000;
  const resultMs = resultDuration * 1000;

  if (timeInCycle < questionMs) {
    return {
      serverNow,
      phase: "question",
      currentChallengeIndex,
      timeLeft: Math.max(0, Math.ceil((questionMs - timeInCycle) / 1000)),
      cycleMs,
      questionTime,
      resultDuration,
      leaderboardDuration,
      totalChallenges
    };
  }

  if (timeInCycle < questionMs + resultMs) {
    return {
      serverNow,
      phase: "result",
      currentChallengeIndex,
      timeLeft: Math.max(0, Math.ceil((questionMs + resultMs - timeInCycle) / 1000)),
      cycleMs,
      questionTime,
      resultDuration,
      leaderboardDuration,
      totalChallenges
    };
  }

  return {
    serverNow,
    phase: "leaderboard",
    currentChallengeIndex,
    timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000)),
    cycleMs,
    questionTime,
    resultDuration,
    leaderboardDuration,
    totalChallenges
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
    questionTime: QUESTION_TIME_SECONDS,
    serverNow: now
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

function hasPlayerAnsweredChallenge(player, challengeIndex) {
  return (player.answers || []).some(answer => {
    return Number(answer.challengeIndex) === Number(challengeIndex);
  });
}

export async function advanceRoomAfterSubmit(roomCode, challengeIndex) {
  const room = await getRoom(roomCode);

  if (!room || room.status !== "started") {
    return null;
  }

  const totalChallenges = room.pack?.challenges?.length || 0;

  if (!totalChallenges) {
    return null;
  }

  const allAnswered =
    room.players.length > 0 &&
    room.players.every(player => {
      return hasPlayerAnsweredChallenge(player, challengeIndex);
    });

  if (!allAnswered) {
    return null;
  }

  const now = Date.now();
  const cycleMs = getCycleMs();

  if (challengeIndex >= totalChallenges - 1) {
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
      status: "finished",
      startedAt: room.started_at,
      endsAt: now,
      serverNow: now,
      phase: "done",
      currentChallengeIndex: challengeIndex,
      timeLeft: 0
    };
  }

  const newStartedAt =
    now -
    (challengeIndex * cycleMs + QUESTION_TIME_SECONDS * 1000);

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
    throw new Error(`Failed to advance room: ${error.message}`);
  }

  return {
    status: "started",
    startedAt: newStartedAt,
    endsAt: newEndsAt,
    serverNow: now,
    phase: "result",
    currentChallengeIndex: challengeIndex,
    timeLeft: RESULT_DURATION_SECONDS
  };
}

export async function finishRoomIfAllDone(roomCode) {
  const upperCode = roomCode.toUpperCase();

  const { data: players } = await supabase
    .from("players")
    .select("finished")
    .eq("room_code", upperCode);

  if (players && players.length > 0 && players.every(player => player.finished)) {
    await supabase
      .from("rooms")
      .update({
        status: "finished",
        ends_at: Date.now()
      })
      .eq("code", upperCode);
  }
}

export async function finishRoomIfTimeExpired(roomCode) {
  const room = await getRoom(roomCode);

  if (!room || room.status !== "started") {
    return null;
  }

  const timing = getRoomTiming(room);

  if (timing.phase !== "done") {
    return null;
  }

  const now = Date.now();

  await supabase
    .from("rooms")
    .update({
      status: "finished",
      ends_at: now
    })
    .eq("code", room.code);

  return {
    status: "finished",
    serverNow: now
  };
}