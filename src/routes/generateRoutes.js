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
  return (alphanumeric / total) < 0.4; // less than 40% real characters = unreadable image
}

async function handleGeneratePack(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const gameMode     = req.body.gameMode || "arena_mix";
    const documentName = req.file?.originalname || "lesson";

    send("progress", { message: "Reading document..." });

    let safeText;

    if (req.body.documentText) {
      // Path A: text already extracted (from a saved lesson)
      safeText = cleanExtractedText(req.body.documentText);
    } else if (req.file) {
      // Path B: extract text from uploaded file
      let extractedText;
      try {
        extractedText = await extractTextFromFile(req.file);
      } catch (extractErr) {
        send("error", { error: extractErr.message });
        return res.end();
      }

      safeText = cleanExtractedText(removeExternalLinks(extractedText));

      if (!safeText || safeText.trim().length < 80) {
        if (req.file.mimetype.startsWith("image/")) {
          send("error", { error: "The image could not be read clearly. Make sure the text is visible, well-lit, and in focus, then try again." });
        } else {
          send("error", { error: "Could not extract enough text. Try a clearer document." });
        }
        return res.end();
      }

      if (isTextGarbled(safeText)) {
        send("error", { error: "The image content appears unclear or contains hard-to-read handwriting. Please use an image with clear printed text." });
        return res.end();
      }
    } else {
      send("error", { error: "No file was uploaded." });
      return res.end();
    }

    send("progress", { message: "AI is generating challenges..." });

    const pack = await generateLearningPackWithAI(safeText, gameMode, (msg) => send("progress", { message: msg }));

    send("done", {
      pack,
      documentName,
      documentText: safeText.slice(0, 8000), // kept for study guide generation
      quiz: {
        title: pack.title, summary: pack.summary,
        concepts: pack.concepts, questions: pack.challenges
      },
      aiOnly: true
    });

    res.end();
  } catch (error) {
    console.error("EROARE generate pack:", error);
    send("error", { error: error.message || "The AI could not generate the challenges." });
    res.end();
  }
}

router.post("/generate-pack", upload.single("document"), handleGeneratePack);
router.post("/generate-quiz", upload.single("document"), handleGeneratePack);

export default router;
