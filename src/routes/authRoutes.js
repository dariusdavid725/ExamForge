import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: "Email, password and username are required." });
  }
  if (username.trim().length < 2) {
    return res.status(400).json({ error: "Username must be at least 2 characters." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const admin = getAdminClient();

  // Check username uniqueness
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: "Username already taken. Choose another." });
  }

  // Create auth user with admin API (bypasses email confirmation)
  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true, // auto-confirm
    user_metadata: { username: username.trim() }
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }
    return res.status(400).json({ error: error.message });
  }

  // Ensure profile exists (trigger should handle it, this is a safety net)
  await admin.from("profiles").upsert({
    id: data.user.id,
    username: username.trim(),
    avatar_color: randomColor()
  }, { onConflict: "id", ignoreDuplicates: true });

  return res.json({ success: true, message: "Account created. You can now log in." });
});

function randomColor() {
  const colors = ["#4f46e5","#00d084","#ff5c5c","#ffd23f","#b48cff","#ff9f1c"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default router;
