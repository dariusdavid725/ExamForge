import "dotenv/config";
import express from "express";
import generateRoutes from "./src/routes/generateRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";

const app = express();

app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));

app.use("/api", generateRoutes);
app.use("/api/rooms", roomRoutes);

// Local dev only — Vercel uses the exported app, not listen()
if (process.env.NODE_ENV !== "production") {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
  });
}

export default app;
