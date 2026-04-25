import "dotenv/config";
import express from "express";
import generateRoutes from "./src/routes/generateRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";

const app = express();

app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));

app.use("/api", generateRoutes);
app.use("/api/rooms", roomRoutes);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
