import express from "express";

const router = express.Router();

// Expose public config (anon key is safe for the frontend)
router.get("/config", (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

export default router;
