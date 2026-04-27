import express from "express";

const router = express.Router();

// Expose public config (anon key is safe for the frontend)
router.get("/config", (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

router.post("/events", (req, res) => {
  const { name, source = "web", meta = {} } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Invalid event name." });
  }

  // Lightweight server-side event log for early product analytics.
  console.info("[product-event]", JSON.stringify({
    name: name.slice(0, 80),
    source: String(source).slice(0, 40),
    meta: typeof meta === "object" && meta ? meta : {},
    at: new Date().toISOString()
  }));

  return res.status(202).json({ ok: true });
});

export default router;
