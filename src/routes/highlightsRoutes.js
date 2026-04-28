import express from "express";
import { createClient } from "@getSupabase()/getSupabase()-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const router = express.Router();

/**
 * POST /api/highlights/create
 * Create a new highlight
 */
router.post("/create", async (req, res) => {
  try {
    const { userId, unitId, textContent, startOffset, endOffset, color } = req.body;

    if (!userId || !unitId || !textContent || startOffset === undefined || endOffset === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await getSupabase()
      .from("unit_highlights")
      .insert({
        user_id: userId,
        unit_id: unitId,
        text_content: textContent,
        start_offset: startOffset,
        end_offset: endOffset,
        color: color || 'yellow'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, highlight: data });
  } catch (error) {
    console.error("Error creating highlight:", error);
    res.status(500).json({ error: "Failed to create highlight" });
  }
});

/**
 * GET /api/highlights/:unitId/:userId
 * Get all highlights for a unit by a user
 */
router.get("/:unitId/:userId", async (req, res) => {
  try {
    const { unitId, userId } = req.params;

    const { data, error } = await getSupabase()
      .from("unit_highlights")
      .select("*")
      .eq("unit_id", unitId)
      .eq("user_id", userId)
      .order("start_offset", { ascending: true });

    if (error) throw error;

    res.json({ highlights: data || [] });
  } catch (error) {
    console.error("Error fetching highlights:", error);
    res.status(500).json({ error: "Failed to fetch highlights" });
  }
});

/**
 * DELETE /api/highlights/:highlightId
 * Delete a highlight
 */
router.delete("/:highlightId", async (req, res) => {
  try {
    const { highlightId } = req.params;

    const { error } = await getSupabase()
      .from("unit_highlights")
      .delete()
      .eq("id", highlightId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting highlight:", error);
    res.status(500).json({ error: "Failed to delete highlight" });
  }
});

/**
 * POST /api/highlights/note
 * Create or update a note for a unit
 */
router.post("/note", async (req, res) => {
  try {
    const { userId, unitId, noteText, positionOffset } = req.body;

    if (!userId || !unitId || !noteText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await getSupabase()
      .from("unit_notes")
      .insert({
        user_id: userId,
        unit_id: unitId,
        note_text: noteText,
        position_offset: positionOffset || null
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, note: data });
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

/**
 * GET /api/highlights/notes/:unitId/:userId
 * Get all notes for a unit by a user
 */
router.get("/notes/:unitId/:userId", async (req, res) => {
  try {
    const { unitId, userId } = req.params;

    const { data, error } = await getSupabase()
      .from("unit_notes")
      .select("*")
      .eq("unit_id", unitId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ notes: data || [] });
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

/**
 * DELETE /api/highlights/note/:noteId
 * Delete a note
 */
router.delete("/note/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;

    const { error } = await getSupabase()
      .from("unit_notes")
      .delete()
      .eq("id", noteId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
