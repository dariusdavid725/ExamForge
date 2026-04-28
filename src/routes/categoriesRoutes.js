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

// ─── GET /api/categories?userId=... ─────────────────────────────────────────────

router.get("/categories", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required." });

  try {
    const { data, error } = await getAdmin()
      .from("lesson_categories")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    // Create minimal default categories if none exist
    if (!data || data.length === 0) {
      const defaultCategories = [
        { user_id: userId, name: 'My Lessons', color: '#4f46e5', icon: '📚', sort_order: 1 }
      ];

      const { data: created, error: createError } = await getAdmin()
        .from("lesson_categories")
        .insert(defaultCategories)
        .select();

      if (createError) throw createError;
      return res.json(created || []);
    }

    return res.json(data);
  } catch (err) {
    console.error("Error fetching categories:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/categories ───────────────────────────────────────────────────────

router.post("/categories", async (req, res) => {
  const { userId, name, color, icon } = req.body;
  if (!userId || !name) return res.status(400).json({ error: "userId and name required." });

  try {
    // Get max sort_order
    const { data: existing } = await getAdmin()
      .from("lesson_categories")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

    const { data, error } = await getAdmin()
      .from("lesson_categories")
      .insert({
        user_id: userId,
        name: name.trim(),
        color: color || '#4f46e5',
        icon: icon || '📚',
        sort_order: nextOrder
      })
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error("Error creating category:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/categories/:id ──────────────────────────────────────────────────

router.patch("/categories/:id", async (req, res) => {
  const { userId, name, color, icon, sort_order } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required." });

  try {
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await getAdmin()
      .from("lesson_categories")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error("Error updating category:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/categories/:id ─────────────────────────────────────────────────

router.delete("/categories/:id", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required." });

  try {
    // First, unlink lessons from this category
    await getAdmin()
      .from("user_lessons")
      .update({ category_id: null })
      .eq("category_id", req.params.id);

    const { error } = await getAdmin()
      .from("lesson_categories")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", userId);

    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting category:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
