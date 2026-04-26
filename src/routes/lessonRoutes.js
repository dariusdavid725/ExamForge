import express from "express";
import OpenAI from "openai";
import { upload } from "../middleware/uploadMiddleware.js";
import { extractTextFromFile } from "../services/documentService.js";
import { cleanExtractedText, removeExternalLinks, prepareDocumentSlice } from "../utils/textUtils.js";
import { checkAndIncrementLimit, getUserPlan } from "../middleware/planMiddleware.js";

const router  = express.Router();
const client  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90000 });
const MODEL   = "gpt-4.1-mini";

// ─── POST /api/lessons/generate ──────────────────────────────────────────────
// Accepts a document (file) OR a free-text topic and returns a structured lesson.

router.post("/generate", upload.single("document"), async (req, res) => {
  try {
    // Plan limit check (3 lessons/week on free plan)
    const userId = req.body.userId;
    if (userId) {
      const check = await checkAndIncrementLimit(userId, "lesson");
      if (!check.allowed) {
        return res.status(403).json({
          error:        check.limitReached
            ? `Ai atins limita saptamanala de 3 lectii. Fa upgrade la Premium pentru lectii nelimitate.`
            : (check.error || "Access denied."),
          limitReached: check.limitReached || false,
          used:         check.used,
          limit:        check.limit
        });
      }
    }

    let isTopic    = false;
    let safeText   = "";
    let returnText = "";

    if (req.body.topic) {
      // ── Path A: user typed a topic ─────────────────────────────────────────
      const topic = String(req.body.topic).trim();
      if (!topic) return res.status(400).json({ error: "Topic cannot be empty." });
      isTopic    = true;
      safeText   = topic;
      returnText = "";
    } else if (req.file) {
      // ── Path B: uploaded file ──────────────────────────────────────────────
      let extractedText;
      try {
        extractedText = await extractTextFromFile(req.file);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      safeText   = cleanExtractedText(removeExternalLinks(extractedText));
      returnText = safeText.slice(0, 8000);

      if (!safeText || safeText.trim().length < 80) {
        return res.status(400).json({ error: "Could not extract enough text. Try a clearer document." });
      }
    } else {
      return res.status(400).json({ error: "Provide a file or a topic." });
    }

    // ── Build prompt ──────────────────────────────────────────────────────────

    const systemMsg = isTopic
      ? [
          "Return ONLY valid JSON. No markdown. No prose outside JSON.",
          "Detect the language of the topic and respond in that language.",
          "If the topic is in Romanian, write everything in Romanian.",
          "If in English, write in English."
        ].join("\n")
      : [
          "Return ONLY valid JSON. No markdown. No prose outside JSON.",
          "Use the EXACT same language as the document.",
          "If the document is in Romanian, write everything in Romanian.",
          "Detect the document language automatically and match it."
        ].join("\n");

    const contentSource = isTopic
      ? `Topic: "${safeText}"\nGenerate a comprehensive lesson about this topic using your knowledge.`
      : `DOCUMENT:\n${prepareDocumentSlice(safeText)}`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2400,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemMsg },
        {
          role: "user",
          content: `Create a comprehensive structured lesson.

JSON schema:
{
  "title": "string",
  "language": "string (e.g. Romanian, English, French)",
  "summary": "string (2-3 sentence overview)",
  "objectives": ["string"],
  "keyConcepts": ["string"],
  "sections": [
    {
      "title": "string",
      "content": "string (detailed explanation, 3-5 sentences)",
      "keyPoints": ["string"]
    }
  ],
  "memoryTips": ["string"]
}

Rules:
- Match language for ALL text fields
- 3-6 sections covering the main topics
- 5-8 key concepts
- 3-5 learning objectives
- 2-4 memory tips

${contentSource}`
        }
      ]
    });

    const raw    = completion.choices[0].message.content;
    const lesson = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return res.json({ lesson, documentText: returnText });
  } catch (error) {
    console.error("ERROR lesson generate:", error);
    return res.status(503).json({ error: error.message || "Could not generate lesson." });
  }
});

// ─── POST /api/lessons/quiz ───────────────────────────────────────────────────
// Given a lesson, generates quiz questions in the same language.

router.post("/quiz", async (req, res) => {
  try {
    const { lesson, documentText, userId } = req.body;

    // Premium-only feature
    const plan = await getUserPlan(userId);
    if (plan !== "premium") {
      return res.status(403).json({
        error:           "Quiz-urile la lectii sunt o functie Premium. Fa upgrade pentru a le debloca.",
        premiumRequired: true
      });
    }

    if (!lesson) return res.status(400).json({ error: "Lesson data required." });

    const context = documentText
      ? documentText.slice(0, 4000)
      : JSON.stringify(lesson).slice(0, 4000);

    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2200,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: [
            "Return ONLY valid JSON. No markdown.",
            `Use the EXACT same language as the lesson: ${lesson.language || "same as lesson"}.`,
            "All questions, options and explanations must be in that language."
          ].join("\n")
        },
        {
          role: "user",
          content: `Create 8 quiz questions based on this lesson.

Mix difficulties: 3 easy, 3 medium, 2 hard.
Cover all major sections of the lesson.
Each question must have exactly 4 options with ONE correct answer.

JSON schema:
{
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string (must match one option exactly)",
      "explanation": "string (explain why this answer is correct)",
      "concept": "string (which key concept this tests)",
      "difficulty": "easy|medium|hard"
    }
  ]
}

LESSON TITLE: ${lesson.title}
LESSON LANGUAGE: ${lesson.language}
KEY CONCEPTS: ${(lesson.keyConcepts || []).join(", ")}
SECTIONS: ${(lesson.sections || []).map(s => s.title).join(", ")}

DOCUMENT CONTEXT:
${context}`
        }
      ]
    });

    const raw  = completion.choices[0].message.content;
    const quiz = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return res.json(quiz);
  } catch (error) {
    console.error("ERROR lesson quiz:", error);
    return res.status(503).json({ error: error.message || "Could not generate quiz." });
  }
});

// ─── POST /api/lessons/report ─────────────────────────────────────────────────
// Analyzes quiz answers and returns a performance report with gap analysis.

router.post("/report", async (req, res) => {
  try {
    const { lesson, questions, userAnswers, userId } = req.body;

    // Premium-only feature
    const plan = await getUserPlan(userId);
    if (plan !== "premium") {
      return res.status(403).json({
        error:           "Rapoartele de performanta sunt o functie Premium. Fa upgrade pentru a le debloca.",
        premiumRequired: true
      });
    }

    if (!lesson || !questions || !userAnswers) {
      return res.status(400).json({ error: "Missing data for report." });
    }

    const results = questions.map((q, i) => ({
      question:      q.question,
      concept:       q.concept,
      difficulty:    q.difficulty,
      userAnswer:    userAnswers[i],
      correctAnswer: q.correctAnswer,
      isCorrect:     userAnswers[i] === q.correctAnswer,
      explanation:   q.explanation
    }));

    const score      = results.filter(r => r.isCorrect).length;
    const percentage = Math.round((score / questions.length) * 100);

    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1800,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: [
            "Return ONLY valid JSON. No markdown.",
            `Use the EXACT same language as the lesson: ${lesson.language || "same as lesson"}.`,
            "Be encouraging but honest. Focus on actionable feedback."
          ].join("\n")
        },
        {
          role: "user",
          content: `Analyze these quiz results and generate a detailed performance report.

JSON schema:
{
  "overallFeedback": "string (personalized, encouraging 2-3 sentence feedback)",
  "strengths": ["string (what they understood well)"],
  "masteredConcepts": ["string"],
  "gapAnalysis": [
    {
      "concept": "string",
      "issue": "string (what specifically wasn't understood)",
      "recommendation": "string (concrete advice to fix this gap)",
      "lessonSection": "string (which lesson section to re-read)"
    }
  ],
  "studyPlan": ["string (prioritized action steps, max 5)"]
}

LESSON: ${lesson.title}
LESSON LANGUAGE: ${lesson.language}
SCORE: ${score}/${questions.length} (${percentage}%)
SECTIONS: ${(lesson.sections || []).map(s => s.title).join(", ")}

QUESTION RESULTS:
${JSON.stringify(results, null, 2)}`
        }
      ]
    });

    const raw      = completion.choices[0].message.content;
    const analysis = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return res.json({ score, total: questions.length, percentage, results, analysis });
  } catch (error) {
    console.error("ERROR lesson report:", error);
    return res.status(503).json({ error: error.message || "Could not generate report." });
  }
});

export default router;
