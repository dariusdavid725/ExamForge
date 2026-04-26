import express from "express";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function needsWeeklyReset(resetDate) {
  if (!resetDate) return true;
  return getWeekStart(new Date()) > getWeekStart(new Date(resetDate));
}

// ─── POST /api/stripe/webhook (raw body — must be first, before json middleware) ──

router.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe not configured." });

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).json({ error: "Invalid signature." });
  }

  const admin = getAdmin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId  = session.metadata?.userId;
    if (userId) {
      await admin.from("profiles").update({
        plan:                    "premium",
        stripe_customer_id:      session.customer,
        stripe_subscription_id:  session.subscription
      }).eq("id", userId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const { data } = await admin.from("profiles")
      .select("id").eq("stripe_customer_id", sub.customer).maybeSingle();
    if (data) {
      await admin.from("profiles").update({
        plan:                   "free",
        stripe_subscription_id: null
      }).eq("id", data.id);
    }
  }

  res.json({ received: true });
});

// ─── JSON parser for the remaining stripe routes ──────────────────────────────

router.use(express.json());

// ─── GET /api/stripe/plan-status?userId=... ───────────────────────────────────

router.get("/stripe/plan-status", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required." });

  const admin = getAdmin();
  const { data, error } = await admin.from("profiles")
    .select("plan, weekly_lessons_count, weekly_quizzes_count, weekly_reset_date")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: "Profile not found." });

  const plan = data.plan || "free";
  const reset = needsWeeklyReset(data.weekly_reset_date);
  const lessonsUsed = reset ? 0 : (data.weekly_lessons_count || 0);
  const quizzesUsed = reset ? 0 : (data.weekly_quizzes_count || 0);

  return res.json({
    plan,
    weeklyLessonsUsed: lessonsUsed,
    weeklyQuizzesUsed: quizzesUsed,
    lessonsLimit:      plan === "premium" ? null : 3,
    quizzesLimit:      plan === "premium" ? null : 3
  });
});

// ─── POST /api/stripe/create-checkout-session ─────────────────────────────────

router.post("/stripe/create-checkout-session", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe not configured." });

  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: "userId and email required." });

  const origin = `${req.protocol}://${req.headers.host}`;

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "subscription",
      customer_email:       email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/pricing`,
      metadata:    { userId }
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/stripe/portal-session ─────────────────────────────────────────

router.post("/stripe/portal-session", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe not configured." });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required." });

  const admin = getAdmin();
  const { data } = await admin.from("profiles")
    .select("stripe_customer_id").eq("id", userId).maybeSingle();

  if (!data?.stripe_customer_id) return res.status(400).json({ error: "No active subscription found." });

  const origin = `${req.protocol}://${req.headers.host}`;

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer:   data.stripe_customer_id,
      return_url: `${origin}/dashboard`
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
