import { createClient } from "@supabase/supabase-js";
import { normalizePlayer } from "../domain/Player.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function findById(playerId) {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();
  return data || null;
}

export async function insert(player) {
  const { error } = await supabase.from("players").insert(player);
  if (error) throw new Error(`Failed to add player: ${error.message}`);
  return normalizePlayer(player);
}

export async function update(playerId, fields) {
  const { error } = await supabase
    .from("players")
    .update(fields)
    .eq("id", playerId);
  if (error) throw new Error(`Failed to update player: ${error.message}`);
}

export async function remove(playerId) {
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId);
  if (error) throw new Error(`Failed to remove player: ${error.message}`);
}

export async function updateByRoomCode(roomCode, fields) {
  const { error } = await supabase
    .from("players")
    .update(fields)
    .eq("room_code", String(roomCode).toUpperCase());
  if (error) throw new Error(`Failed to update players in room: ${error.message}`);
}
