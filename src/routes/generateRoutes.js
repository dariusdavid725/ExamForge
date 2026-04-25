import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import { extractTextFromFile } from "../services/documentService.js";
import { generateLearningPackWithAI } from "../services/aiService.js";
import { cleanExtractedText, removeExternalLinks } from "../utils/textUtils.js";

const router = express.Router();

function isTextGarbled(text) {
  const alphanumeric = (text.match(/[a-zA-ZÀ-ž0-9]/g) || []).length;
  const total        = text.replace(/\s/g, "").length;
  if (total === 0) return true;
  return (alphanumeric / total) < 0.4; // mai puțin de 40% caractere reale = imagine necitibilă
}

async function handleGeneratePack(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    if (!req.file) {
      send("error", { error: "Nu ai încărcat niciun fișier." });
      return res.end();
    }

    const gameMode    = req.body.gameMode    || "arena_mix";
    const documentName = req.file.originalname || "document";

    send("progress", { message: "Reading document..." });

    let extractedText;
    try {
      extractedText = await extractTextFromFile(req.file);
    } catch (extractErr) {
      send("error", { error: extractErr.message });
      return res.end();
    }

    const safeText = cleanExtractedText(removeExternalLinks(extractedText));

    // Detectăm imagine necitibilă
    if (!safeText || safeText.trim().length < 80) {
      if (req.file.mimetype.startsWith("image/")) {
        send("error", { error: "Imaginea nu a putut fi citită clar. Asigură-te că textul este vizibil, bine iluminat și în focus, apoi încearcă din nou." });
      } else {
        send("error", { error: "Nu am putut extrage suficient text. Încearcă un document mai clar." });
      }
      return res.end();
    }

    if (isTextGarbled(safeText)) {
      send("error", { error: "Conținutul imaginii pare neclar sau este un scris de mână greu lizibil. Te rugăm să folosești o imagine cu text tipărit clar." });
      return res.end();
    }

    send("progress", { message: "AI is generating challenges..." });

    const pack = await generateLearningPackWithAI(safeText, gameMode, (msg) => send("progress", { message: msg }));

    send("done", {
      pack,
      documentName,
      documentText: safeText.slice(0, 8000), // păstrăm pentru conspect
      quiz: {
        title: pack.title, summary: pack.summary,
        concepts: pack.concepts, questions: pack.challenges
      },
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
