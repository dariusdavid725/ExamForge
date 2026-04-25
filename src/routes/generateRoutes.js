import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import { extractTextFromFile } from "../services/documentService.js";
import { generateLearningPackWithAI } from "../services/aiService.js";
import { cleanExtractedText, removeExternalLinks } from "../utils/textUtils.js";

const router = express.Router();

async function handleGeneratePack(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Note: no res.flushHeaders() — crashes on Vercel serverless

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    if (!req.file) {
      send("error", { error: "Nu ai încărcat niciun fișier." });
      return res.end();
    }

    const gameMode = req.body.gameMode || "arena_mix";

    send("progress", { message: "Reading document..." });
    const extractedText = await extractTextFromFile(req.file);
    const safeText = cleanExtractedText(removeExternalLinks(extractedText));

    if (!safeText || safeText.trim().length < 100) {
      send("error", { error: "Nu am putut extrage suficient text. Încearcă un document mai clar." });
      return res.end();
    }

    send("progress", { message: "AI is generating challenges..." });

    const pack = await generateLearningPackWithAI(safeText, gameMode, (message) => {
      send("progress", { message });
    });

    send("done", {
      pack,
      quiz: {
        title: pack.title,
        summary: pack.summary,
        concepts: pack.concepts,
        questions: pack.challenges
      },
      preview: safeText.slice(0, 800),
      aiOnly: true
    });

    res.end();
  } catch (error) {
    console.error("EROARE generate pack:", error);
    send("error", { error: error.message || "AI-ul nu a putut genera challenge-urile." });
    res.end();
  }
}

router.post("/generate-pack", upload.single("document"), handleGeneratePack);
router.post("/generate-quiz", upload.single("document"), handleGeneratePack);

export default router;
