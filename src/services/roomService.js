import { QUESTION_TIME_SECONDS, EXTRA_RESULTS_BUFFER_MS } from "../config/constants.js";
import { createTextHash } from "../utils/textUtils.js";

const rooms = {};

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms[code] ? generateRoomCode() : code;
}

function generatePlayerId() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

export function getRoom(code) {
  return rooms[String(code || "").toUpperCase()] || null;
}

export function createRoom(pack) {
  const code = generateRoomCode();

  rooms[code] = {
    code,
    pack,
    status: "lobby",
    createdAt: Date.now(),
    players: [],
    startedAt: null,
    endsAt: null,
    questionTime: QUESTION_TIME_SECONDS,
    roomHash: createTextHash(JSON.stringify(pack), code)
  };

  return rooms[code];
}

export function addPlayerToRoom(room, name) {
  const player = {
    id: generatePlayerId(),
    name,
    score: 0,
    correct: 0,
    totalAnswered: 0,
    finished: false,
    answers: [],
    weakConcepts: []
  };

  room.players.push(player);
  return player;
}

export function startRoom(room) {
  room.status = "started";
  room.startedAt = Date.now();
  room.questionTime = QUESTION_TIME_SECONDS;
  room.endsAt =
    room.startedAt +
    room.pack.challenges.length * room.questionTime * 1000 +
    EXTRA_RESULTS_BUFFER_MS;
  return room;
}

export function finishRoomIfAllDone(room) {
  const allFinished =
    room.players.length > 0 && room.players.every(p => p.finished);

  if (allFinished) {
    room.status = "finished";
    room.endsAt = Date.now();
  }
}
