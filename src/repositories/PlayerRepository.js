import { createClient } from "@supabase/supabase-js";
import { normalizePlayer } from "../domain/Player.js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function findById(playerId) {
  const { data } = await getSupabase()
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();
  return data || null;
}

export async function insert(player) {
  const { error } = await getSupabase().from("players").insert(player);
  if (error) throw new Error(`Failed to add player: ${error.message}`);
  return normalizePlayer(player);
}

export async function update(playerId, fields) {
  const { error } = await getSupabase()
    .from("players")
    .update(fields)
    .eq("id", playerId);
  if (error) throw new Error(`Failed to update player: ${error.message}`);
}

export async function remove(playerId) {
  const { error } = await getSupabase()
    .from("players")
    .delete()
    .eq("id", playerId);
  if (error) throw new Error(`Failed to remove player: ${error.message}`);
}

export async function updateByRoomCode(roomCode, fields) {
  const { error } = await getSupabase()
    .from("players")
    .update(fields)
    .eq("room_code", String(roomCode).toUpperCase());
  if (error) throw new Error(`Failed to update players in room: ${error.message}`);
}
