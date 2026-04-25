import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import generateRoutes from "./src/routes/generateRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));

app.use("/api", generateRoutes);
app.use("/api/rooms", roomRoutes);

// Vercel injectează VERCEL=1 automat — pe Railway și local, pornim serverul normal
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
