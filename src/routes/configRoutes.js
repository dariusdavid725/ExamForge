import express from "express";

const router = express.Router();

// Expune config public (anon key e sigur în frontend)
router.get("/config", (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

export default router;
