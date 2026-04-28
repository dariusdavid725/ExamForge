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

const ADMIN_BOOTSTRAP_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "dariusdavid26@yahoo.com")
    .split(",")
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
);

async function getAdminUserFromRequest(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data?.user) return null;

  const user = data.user;
  const { data: profile } = await getAdmin()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const email = String(user.email || "").toLowerCase();
  const isAdmin = Boolean(profile?.is_admin) || ADMIN_BOOTSTRAP_EMAILS.has(email);
  if (!isAdmin) return null;

  return user;
}

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

  const safePayload = {
    name: name.slice(0, 80),
    source: String(source).slice(0, 40),
    meta: typeof meta === "object" && meta ? meta : {}
  };

  getAdmin()
    .from("product_events")
    .insert(safePayload)
    .then(({ error }) => {
      if (error) {
        console.error("Failed to store product event:", error);
      }
    })
    .catch(err => {
      console.error("Unexpected product event error:", err);
    });

  return res.status(202).json({ ok: true });
});

router.get("/events/stats", async (req, res) => {
  try {
    const adminUser = await getAdminUserFromRequest(req);
    if (!adminUser) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eventNames = [
      "activation_demo_start_clicked",
      "activation_demo_started",
      "activation_demo_completed"
    ];

    const { data, error } = await getAdmin()
      .from("product_events")
      .select("name")
      .in("name", eventNames)
      .gte("created_at", since);

    if (error) {
      return res.status(500).json({ error: "Could not load event stats." });
    }

    const counters = {
      activation_demo_start_clicked: 0,
      activation_demo_started: 0,
      activation_demo_completed: 0
    };

    (data || []).forEach(row => {
      if (counters[row.name] !== undefined) counters[row.name] += 1;
    });

    const toPct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;

    return res.json({
      windowDays: 7,
      counts: counters,
      rates: {
        clickToStart: toPct(counters.activation_demo_started, counters.activation_demo_start_clicked),
        startToComplete: toPct(counters.activation_demo_completed, counters.activation_demo_started),
        clickToComplete: toPct(counters.activation_demo_completed, counters.activation_demo_start_clicked)
      }
    });
  } catch (error) {
    console.error("Could not get product event stats:", error);
    return res.status(500).json({ error: "Could not load event stats." });
  }
});

export default router;
