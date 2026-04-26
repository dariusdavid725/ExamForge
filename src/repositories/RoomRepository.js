import { createClient } from "@supabase/supabase-js";
import { normalizePlayer } from "../domain/Player.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function findByCode(code) {
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

export async function insert(room) {
  const { error } = await supabase.from("rooms").insert(room);
  if (error) throw new Error(`Failed to create room: ${error.message}`);
  return room;
}

export async function update(code, fields) {
  const { error } = await supabase
    .from("rooms")
    .update(fields)
    .eq("code", String(code).toUpperCase());
  if (error) throw new Error(`Failed to update room: ${error.message}`);
}

export async function codeExists(code) {
  const { data } = await supabase
    .from("rooms")
    .select("code")
    .eq("code", String(code).toUpperCase())
    .maybeSingle();
  return Boolean(data);
}
