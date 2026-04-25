import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import configRoutes from "./src/routes/configRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import generateRoutes from "./src/routes/generateRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";
import conspectRoutes from "./src/routes/conspectRoutes.js";
import sessionRoutes from "./src/routes/sessionRoutes.js";
import roomInviteRoutes from "./src/routes/roomInviteRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));

app.use("/api", configRoutes);
app.use("/api", authRoutes);
app.use("/api", generateRoutes);
app.use("/api", conspectRoutes);
app.use("/api", sessionRoutes);
app.use("/api", roomInviteRoutes);
app.use("/api/rooms", roomRoutes);

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;