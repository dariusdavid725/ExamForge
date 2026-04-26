import express from "express";
import OpenAI from "openai";
import { cleanExtractedText, removeExternalLinks, prepareDocumentSlice } from "../utils/textUtils.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const router  = express.Router();

router.post("/conspect", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: "Insufficient text for study guide." });
    }

    const safeText = prepareDocumentSlice(cleanExtractedText(removeExternalLinks(text)));

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 1800,
      temperature: 0.3,
      messages: [
        { role: "system", content: "Return strict valid JSON only. No markdown." },
        { role: "user", content: `
Create a concise study guide (conspect) from this document. Use the same language as the document.

JSON schema:
{
  "title": "string",
  "subject": "string",
  "overview": "string (2-3 sentences)",
  "sections": [
    {
      "title": "string",
      "keyPoints": ["string"],
      "definitions": [{"term": "string", "definition": "string"}]
    }
  ],
  "memoryTips": ["string"],
  "category": "one of: Mathematics, Programming, Science, History, Literature, Language, Economics, Philosophy, Art, General Knowledge, Medicine, Law, Engineering, Physics, Chemistry, Biology, Other"
}

DOCUMENT:
${safeText}
` }
      ]
    });

    const raw  = completion.choices[0].message.content;
    const data = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return res.json({ conspect: data });
  } catch (error) {
    console.error("EROARE conspect:", error);
    return res.status(503).json({ error: "Could not generate study guide." });
  }
});

export default router;
