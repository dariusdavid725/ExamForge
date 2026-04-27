import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const ADMIN_BOOTSTRAP_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "dariusdavid26@yahoo.com")
    .split(",")
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
);

async function getRequestUser(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function isAdminUser(user) {
  if (!user) return false;

  const email = String(user.email || "").toLowerCase();
  if (ADMIN_BOOTSTRAP_EMAILS.has(email)) return true;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return Boolean(profile?.is_admin);
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized." });

    const isAdmin = await isAdminUser(user);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden." });

    req.adminUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Admin check failed." });
  }
}

async function listUsersByEmail() {
  const usersByEmail = new Map();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200
    });
    if (error) throw new Error(error.message || "Could not list users.");

    const users = data?.users || [];
    users.forEach(user => {
      const email = String(user.email || "").toLowerCase();
      if (email) usersByEmail.set(email, user);
    });

    if (users.length < 200) break;
    page += 1;
  }

  return usersByEmail;
}

router.get("/admin/overview", requireAdmin, async (_req, res) => {
  try {
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: usersCount }, { count: premiumCount }, { count: eventsCount }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "premium"),
      supabaseAdmin.from("product_events").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgoIso)
    ]);

    return res.json({
      usersCount: usersCount || 0,
      premiumCount: premiumCount || 0,
      events7d: eventsCount || 0
    });
  } catch (error) {
    return res.status(500).json({ error: "Could not load admin overview." });
  }
});

router.get("/admin/admins", requireAdmin, async (_req, res) => {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, is_admin")
      .eq("is_admin", true);
    if (error) return res.status(500).json({ error: "Could not load admins." });

    const usersByEmail = await listUsersByEmail();

    const admins = (profiles || []).map(profile => {
      const authUser = [...usersByEmail.values()].find(user => user.id === profile.id);
      return {
        id: profile.id,
        username: profile.username || "User",
        email: authUser?.email || null,
        isAdmin: true
      };
    });

    return res.json({ admins });
  } catch (error) {
    return res.status(500).json({ error: "Could not load admins." });
  }
});

router.post("/admin/admins", requireAdmin, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const isAdmin = Boolean(req.body.isAdmin);

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const usersByEmail = await listUsersByEmail();
    const targetUser = usersByEmail.get(email);
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    if (!isAdmin && targetUser.id === req.adminUser.id) {
      return res.status(400).json({ error: "You cannot remove your own admin access." });
    }

    if (!isAdmin) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_admin", true);

      if ((count || 0) <= 1) {
        return res.status(400).json({ error: "Cannot remove the last admin. Add another admin first." });
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_admin: isAdmin })
      .eq("id", targetUser.id);

    if (error) return res.status(500).json({ error: "Could not update admin role." });

    await supabaseAdmin.from("admin_audit_logs").insert({
      action: isAdmin ? "admin_granted" : "admin_revoked",
      actor_id: req.adminUser.id,
      target_email: email,
      target_id: targetUser.id,
      metadata: { previous_state: !isAdmin, new_state: isAdmin }
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Could not update admin role." });
  }
});

router.get("/admin/events/recent", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_events")
      .select("id, name, source, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return res.status(500).json({ error: "Could not load recent events." });

    return res.json({ events: data || [] });
  } catch (error) {
    return res.status(500).json({ error: "Could not load recent events." });
  }
});

router.get("/admin/audit-logs", requireAdmin, async (_req, res) => {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("id, action, actor_id, target_email, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: "Could not load audit logs." });

    const usersByEmail = await listUsersByEmail();
    const enriched = (logs || []).map(log => {
      const actor = [...usersByEmail.values()].find(u => u.id === log.actor_id);
      return {
        ...log,
        actor_email: actor?.email || "Unknown"
      };
    });

    return res.json({ logs: enriched });
  } catch (error) {
    return res.status(500).json({ error: "Could not load audit logs." });
  }
});

export default router;
