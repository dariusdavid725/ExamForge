import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/user-lessons?userId=...
router.get("/user-lessons", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required." });

  const { data, error } = await getAdmin()
    .from("user_lessons")
    .select("id, title, language, document_text, last_quiz_score, last_quiz_date, review_topics, created_at, lesson")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data || []);
});

// POST /api/user-lessons
router.post("/user-lessons", async (req, res) => {
  const { userId, lesson, documentText } = req.body;
  if (!userId || !lesson) return res.status(400).json({ error: "userId and lesson required." });

  const { data, error } = await getAdmin()
    .from("user_lessons")
    .insert({
      user_id:       userId,
      title:         lesson.title    || "Lesson",
      language:      lesson.language || "Unknown",
      lesson,
      document_text: (documentText || "").slice(0, 8000),
      review_topics: []
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// PATCH /api/user-lessons/:id  (update quiz score + review topics)
router.patch("/user-lessons/:id", async (req, res) => {
  const { userId, percentage, reviewTopics } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required." });

  const { data, error } = await getAdmin()
    .from("user_lessons")
    .update({
      last_quiz_score: percentage,
      last_quiz_date:  new Date().toISOString(),
      review_topics:   (reviewTopics || []).slice(0, 8)
    })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /api/user-lessons/:id
router.delete("/user-lessons/:id", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required." });

  const { error } = await getAdmin()
    .from("user_lessons")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
