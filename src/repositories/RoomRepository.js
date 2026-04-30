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

  // Do NOT .order("created_at") here: many DBs lack players.created_at until migration runs.
  // Ordering on a missing column makes PostgREST fail and returns no rows (empty lobby + "No host found").
  const { data: playerRows, error: playersError } = await getSupabase()
    .from("players")
    .select("*")
    .eq("room_code", upperCode);

  if (playersError) {
    console.error("[RoomRepository] players query failed:", playersError.message);
  }

  const rows = playerRows || [];
  const sorted = [...rows].sort((a, b) => {
    const ta = a.created_at != null ? Number(a.created_at) : 0;
    const tb = b.created_at != null ? Number(b.created_at) : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  return {
    ...room,
    players: sorted.map(normalizePlayer)
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
