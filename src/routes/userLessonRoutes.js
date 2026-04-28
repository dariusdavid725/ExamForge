import express from "express";
import { createClient } from "@supabase/supabase-js";
import { generateLessonTitle, suggestCategory } from "../services/titleGenerator.js";

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
    .select("id, title, language, document_text, last_quiz_score, last_quiz_date, review_topics, created_at, lesson, category_id, custom_title, auto_title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data || []);
});

// POST /api/user-lessons
router.post("/user-lessons", async (req, res) => {
  const { userId, lesson, documentText, categoryId } = req.body;
  if (!userId || !lesson) return res.status(400).json({ error: "userId and lesson required." });

  try {
    // Generate AI title in background (don't block save)
    let autoTitle = lesson.title || "Lesson";
    generateLessonTitle(lesson, documentText).then(title => {
      if (title && title !== "Untitled Lesson") {
        autoTitle = title;
      }
    }).catch(err => console.error("Title generation error:", err));

    // Get user's categories for smart suggestion
    let suggestedCategoryId = categoryId || null;
    if (!suggestedCategoryId) {
      const { data: categories } = await getAdmin()
        .from("lesson_categories")
        .select("id, name")
        .eq("user_id", userId);
      
      if (categories && categories.length > 0) {
        suggestedCategoryId = await suggestCategory(lesson, categories);
      }
    }

    const { data, error } = await getAdmin()
      .from("user_lessons")
      .insert({
        user_id:       userId,
        title:         lesson.title || autoTitle,
        language:      lesson.language || "Unknown",
        lesson,
        document_text: (documentText || "").slice(0, 8000),
        review_topics: [],
        auto_title:    autoTitle,
        custom_title:  null,
        category_id:   suggestedCategoryId
      })
      .select()
      .single();

    if (error) throw error;

    // Update auto_title async after generation completes
    setTimeout(async () => {
      try {
        const generatedTitle = await generateLessonTitle(lesson, documentText);
        if (generatedTitle && generatedTitle !== "Untitled Lesson" && data?.id) {
          await getAdmin()
            .from("user_lessons")
            .update({ auto_title: generatedTitle })
            .eq("id", data.id);
        }
      } catch (err) {
        console.error("Async title update error:", err);
      }
    }, 100);

    return res.json(data);
  } catch (err) {
    console.error("Save lesson error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/user-lessons/:id  (update quiz score + review topics + title + category)
router.patch("/user-lessons/:id", async (req, res) => {
  const { userId, percentage, reviewTopics, customTitle, categoryId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required." });

  try {
    const updates = {};
    
    // Quiz score updates
    if (percentage !== undefined) {
      updates.last_quiz_score = percentage;
      updates.last_quiz_date = new Date().toISOString();
    }
    if (reviewTopics !== undefined) {
      updates.review_topics = (reviewTopics || []).slice(0, 8);
    }

    // Title update (rename)
    if (customTitle !== undefined) {
      updates.custom_title = customTitle ? customTitle.trim() : null;
    }

    // Category update (move to folder)
    if (categoryId !== undefined) {
      updates.category_id = categoryId || null;
    }

    const { data, error } = await getAdmin()
      .from("user_lessons")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error("Update lesson error:", err);
    return res.status(500).json({ error: err.message });
  }
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
