import { createClient } from "@supabase/supabase-js";
import { QUESTION_TIME_SECONDS, EXTRA_RESULTS_BUFFER_MS } from "../config/constants.js";
import { createTextHash } from "../utils/textUtils.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generatePlayerId() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

function normalizePlayer(p) {
  return {
    id: p.id,
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

  return { ...room, players: (players || []).map(normalizePlayer) };
}

export async function createRoom(pack) {
  let code = generateRoomCode();

  while (true) {
    const { data } = await supabase.from("rooms").select("code").eq("code", code).maybeSingle();
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
  if (error) throw new Error(`Failed to create room: ${error.message}`);

  return { ...room, players: [] };
}

export async function addPlayerToRoom(roomCode, name) {
  const player = {
    id: generatePlayerId(),
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
  if (error) throw new Error(`Failed to add player: ${error.message}`);

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

  if (!room) throw new Error("Room not found");

  const endsAt =
    now +
    room.pack.challenges.length * QUESTION_TIME_SECONDS * 1000 +
    EXTRA_RESULTS_BUFFER_MS;

  const { error } = await supabase
    .from("rooms")
    .update({ status: "started", started_at: now, ends_at: endsAt, question_time: QUESTION_TIME_SECONDS })
    .eq("code", upperCode);

  if (error) throw new Error(`Failed to start room: ${error.message}`);

  return { status: "started", startedAt: now, endsAt, questionTime: QUESTION_TIME_SECONDS };
}

export async function getPlayer(playerId) {
  const { data } = await supabase.from("players").select("*").eq("id", playerId).single();
  return data || null;
}

export async function updatePlayer(playerId, updates) {
  const { error } = await supabase.from("players").update(updates).eq("id", playerId);
  if (error) throw new Error(`Failed to update player: ${error.message}`);
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
      .update({ status: "finished", ends_at: Date.now() })
      .eq("code", upperCode);
  }
}
