import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const ADMIN_EVENT_EMAILS = new Set([
  "dariusdavid26@yahoo.com"
]);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

  supabaseAdmin
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
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!ADMIN_EVENT_EMAILS.has(email)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eventNames = [
      "activation_demo_start_clicked",
      "activation_demo_started",
      "activation_demo_completed"
    ];

    const { data, error } = await supabaseAdmin
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
