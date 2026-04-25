import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import generateRoutes from "./src/routes/generateRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Absolute path required — Vercel's CWD is not always the project root
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));

app.use("/api", generateRoutes);
app.use("/api/rooms", roomRoutes);

// Local dev only — Vercel uses the exported default app
if (process.env.NODE_ENV !== "production") {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
  });
}

export default app;
