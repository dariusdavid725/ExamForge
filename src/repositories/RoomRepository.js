import { createClient } from "@supabase/supabase-js";
import { normalizePlayer } from "../domain/Player.js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function findByCode(code) {
  const upperCode = String(code || "").toUpperCase();

  const { data: room } = await getSupabase()
    .from("rooms")
    .select("*")
    .eq("code", upperCode)
    .single();

  if (!room) return null;

  const { data: players } = await getSupabase()
    .from("players")
    .select("*")
    .eq("room_code", upperCode)
    .order("created_at", { ascending: true });

  return {
    ...room,
    players: (players || []).map(normalizePlayer)
  };
}

export async function insert(room) {
  const { error } = await getSupabase().from("rooms").insert(room);
  if (error) throw new Error(`Failed to create room: ${error.message}`);
  return room;
}

export async function update(code, fields) {
  const { error } = await getSupabase()
    .from("rooms")
    .update(fields)
    .eq("code", String(code).toUpperCase());
  if (error) throw new Error(`Failed to update room: ${error.message}`);
}

export async function codeExists(code) {
  const { data } = await getSupabase()
    .from("rooms")
    .select("code")
    .eq("code", String(code).toUpperCase())
    .maybeSingle();
  return Boolean(data);
}
