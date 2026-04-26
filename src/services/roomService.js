import {
  QUESTION_TIME_SECONDS,
  RESULT_DURATION_SECONDS,
  LEADERBOARD_DURATION_SECONDS,
  EXTRA_RESULTS_BUFFER_MS
} from "../config/constants.js";
import { createTextHash } from "../utils/textUtils.js";
import { makeRoom } from "../domain/Room.js";
import { makePlayer, normalizePlayer } from "../domain/Player.js";
import * as RoomRepo from "../repositories/RoomRepository.js";
import * as PlayerRepo from "../repositories/PlayerRepository.js";

// ─── Timing helpers ───────────────────────────────────────────────────────────

export function getCycleMs() {
  return (QUESTION_TIME_SECONDS + RESULT_DURATION_SECONDS + LEADERBOARD_DURATION_SECONDS) * 1000;
}

export function getRoomTiming(room, serverNow = Date.now()) {
  const totalChallenges = room?.pack?.challenges?.length || 0;
  const questionTime    = Number(room?.question_time || QUESTION_TIME_SECONDS);
  const cycleMs         = getCycleMs();

  if (!room || room.status === "lobby" || !room.started_at || totalChallenges === 0) {
    return { serverNow, phase: "lobby", currentChallengeIndex: 0, timeLeft: questionTime, cycleMs, questionTime, totalChallenges };
  }

  if (room.status === "closed") {
    return { serverNow, phase: "closed", currentChallengeIndex: 0, timeLeft: 0, cycleMs, questionTime, totalChallenges };
  }

  if (room.status === "finished") {
    return { serverNow, phase: "done", currentChallengeIndex: Math.max(0, totalChallenges - 1), timeLeft: 0, cycleMs, questionTime, totalChallenges };
  }

  const elapsed    = Math.max(0, serverNow - Number(room.started_at));
  const totalDuration = totalChallenges * cycleMs;

  if (elapsed >= totalDuration) {
    return { serverNow, phase: "done", currentChallengeIndex: Math.max(0, totalChallenges - 1), timeLeft: 0, cycleMs, questionTime, totalChallenges };
  }

  const currentChallengeIndex = Math.min(Math.floor(elapsed / cycleMs), totalChallenges - 1);
  const timeInCycle = elapsed % cycleMs;
  const questionMs  = questionTime * 1000;
  const resultMs    = RESULT_DURATION_SECONDS * 1000;

  if (timeInCycle < questionMs) {
    return { serverNow, phase: "question", currentChallengeIndex, timeLeft: Math.max(0, Math.ceil((questionMs - timeInCycle) / 1000)), cycleMs, questionTime, totalChallenges };
  }

  if (timeInCycle < questionMs + resultMs) {
    return { serverNow, phase: "result", currentChallengeIndex, timeLeft: Math.max(0, Math.ceil((questionMs + resultMs - timeInCycle) / 1000)), cycleMs, questionTime, totalChallenges };
  }

  return { serverNow, phase: "leaderboard", currentChallengeIndex, timeLeft: Math.max(0, Math.ceil((cycleMs - timeInCycle) / 1000)), cycleMs, questionTime, totalChallenges };
}

// ─── Room code generation ─────────────────────────────────────────────────────

async function generateUniqueRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (await RoomRepo.codeExists(code));

  return code;
}

// ─── Room operations ──────────────────────────────────────────────────────────

export async function getRoom(code) {
  return RoomRepo.findByCode(code);
}

export async function createRoom(pack) {
  const code = await generateUniqueRoomCode();
  const room = makeRoom({ code, pack });
  room.room_hash = createTextHash(JSON.stringify(pack), code);

  await RoomRepo.insert(room);

  return { ...room, players: [] };
}

export async function addPlayerToRoom(roomCode, name, userId = null) {
  const player = makePlayer({ name, roomCode, userId });
  return PlayerRepo.insert(player);
}

export async function startRoom(code) {
  const room = await RoomRepo.findByCode(code);

  if (!room) throw new Error("Room not found.");
  if (room.status === "closed") throw new Error("The arena has been closed.");

  const now     = Date.now();
  const cycleMs = getCycleMs();
  const endsAt  = now + room.pack.challenges.length * cycleMs + EXTRA_RESULTS_BUFFER_MS;

  await RoomRepo.update(code, {
    status: "started",
    started_at: now,
    ends_at: endsAt,
    question_time: QUESTION_TIME_SECONDS
  });

  return { status: "started", startedAt: now, endsAt, questionTime: QUESTION_TIME_SECONDS, serverNow: now };
}

export async function getPlayer(playerId) {
  return PlayerRepo.findById(playerId);
}

export async function updatePlayer(playerId, updates) {
  return PlayerRepo.update(playerId, updates);
}

export async function advanceRoomAfterSubmit(roomCode, challengeIndex) {
  const room = await RoomRepo.findByCode(roomCode);
  if (!room || room.status !== "started") return null;

  const totalChallenges = room.pack?.challenges?.length || 0;
  if (!totalChallenges) return null;

  const activePlayers = room.players.filter(p => !p.abandoned);
  const allAnswered   = activePlayers.length > 0 &&
    activePlayers.every(p => (p.answers || []).some(a => Number(a.challengeIndex) === Number(challengeIndex)));

  if (!allAnswered) return null;

  const now     = Date.now();
  const cycleMs = getCycleMs();

  if (challengeIndex >= totalChallenges - 1) {
    await RoomRepo.update(roomCode, { status: "finished", ends_at: now });
    return { status: "finished", startedAt: room.started_at, endsAt: now, serverNow: now, phase: "done", currentChallengeIndex: challengeIndex, timeLeft: 0 };
  }

  const newStartedAt = now - (challengeIndex * cycleMs + QUESTION_TIME_SECONDS * 1000);
  const newEndsAt    = newStartedAt + totalChallenges * cycleMs + EXTRA_RESULTS_BUFFER_MS;

  await RoomRepo.update(roomCode, { started_at: newStartedAt, ends_at: newEndsAt });

  return { status: "started", startedAt: newStartedAt, endsAt: newEndsAt, serverNow: now, phase: "result", currentChallengeIndex: challengeIndex, timeLeft: RESULT_DURATION_SECONDS };
}

export async function finishRoomIfAllDone(roomCode) {
  const room = await RoomRepo.findByCode(roomCode);
  if (!room || room.status !== "started") return;

  const activePlayers = room.players.filter(p => !p.abandoned);
  if (activePlayers.length > 0 && activePlayers.every(p => p.finished)) {
    await RoomRepo.update(roomCode, { status: "finished", ends_at: Date.now() });
  }
}

export async function finishRoomIfTimeExpired(roomCode) {
  const room = await RoomRepo.findByCode(roomCode);
  if (!room || room.status !== "started") return null;

  const timing = getRoomTiming(room);
  if (timing.phase !== "done") return null;

  const now = Date.now();
  await RoomRepo.update(roomCode, { status: "finished", ends_at: now });

  return { status: "finished", serverNow: now };
}

export async function closeRoom(roomCode, playerId) {
  const room = await RoomRepo.findByCode(roomCode);
  if (!room) throw new Error("Room not found.");

  const host = room.players[0];
  if (!host || host.id !== playerId) throw new Error("Only the host can close the arena.");

  const now = Date.now();
  await RoomRepo.update(roomCode, { status: "closed", closed_by: host.userId || null, closed_at: now, ends_at: now });
  await PlayerRepo.updateByRoomCode(roomCode, { abandoned: true, left_at: now, finished: false });

  return { status: "closed", serverNow: now };
}

export async function leaveRoom(roomCode, playerId) {
  const room = await RoomRepo.findByCode(roomCode);
  if (!room) throw new Error("Room not found.");

  const player = room.players.find(p => p.id === playerId);
  if (!player) throw new Error("Player not found.");

  const now = Date.now();

  if (room.status === "lobby") {
    await PlayerRepo.remove(playerId);
    return { status: "left", serverNow: now };
  }

  if (room.status === "started") {
    await PlayerRepo.update(playerId, { abandoned: true, left_at: now, finished: false });
    await finishRoomIfAllDone(roomCode);
    return { status: "abandoned", serverNow: now };
  }

  return { status: room.status, serverNow: now };
}
