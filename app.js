import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import configRoutes      from "./src/routes/configRoutes.js";
import authRoutes        from "./src/routes/authRoutes.js";
import generateRoutes    from "./src/routes/generateRoutes.js";
import roomRoutes        from "./src/routes/roomRoutes.js";
import conspectRoutes    from "./src/routes/conspectRoutes.js";
import sessionRoutes     from "./src/routes/sessionRoutes.js";
import roomInviteRoutes  from "./src/routes/roomInviteRoutes.js";
import lessonRoutes      from "./src/routes/lessonRoutes.js";
import stripeRoutes      from "./src/routes/stripeRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub       = p => path.join(__dirname, "public", "pages", p);

const app = express();

// ─── Page routes (clean URLs) ─────────────────────────────────────────────────
app.get("/",               (_req, res) => res.sendFile(pub("home.html")));
app.get("/create",         (_req, res) => res.sendFile(pub("create.html")));
app.get("/join",           (_req, res) => res.sendFile(pub("join.html")));
app.get("/login",          (_req, res) => res.sendFile(pub("login.html")));
app.get("/dashboard",      (_req, res) => res.sendFile(pub("dashboard.html")));
app.get("/arena",          (_req, res) => res.sendFile(pub("arena.html")));
app.get("/lessons",        (_req, res) => res.sendFile(pub("lessons.html")));
app.get("/pricing",        (_req, res) => res.sendFile(pub("pricing.html")));
app.get("/upgrade-success",(_req, res) => res.sendFile(pub("upgrade-success.html")));

// ─── Static assets (css, js, images) ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// Stripe routes MUST be registered before express.json() so the webhook handler
// can access the raw body for signature verification.
app.use("/api", stripeRoutes);

app.use(express.json({ limit: "10mb" }));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api", configRoutes);
app.use("/api", authRoutes);
app.use("/api", generateRoutes);
app.use("/api", conspectRoutes);
app.use("/api", sessionRoutes);
app.use("/api", roomInviteRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/lessons", lessonRoutes);

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

export default app;
