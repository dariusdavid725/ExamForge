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
          content: `Create a cognitively optimized lesson following evidence-based learning principles.

Research principles to apply:
1. Dual Coding: combine verbal explanations with concrete examples
2. Elaborative Interrogation: explain "why" and "how"
3. Chunking: break complex ideas into digestible pieces
4. Retrieval Cues: provide memory hooks tied to prior knowledge
5. Metacognition: help learners monitor their understanding

JSON schema:
{
  "title": "string",
  "language": "string (e.g. Romanian, English, French)",
  "summary": "string (2-3 sentence overview)",
  "objectives": ["string (specific, measurable learning goals)"],
  "keyConcepts": ["string (core ideas with brief context)"],
  "sections": [
    {
      "title": "string",
      "content": "string (explanation with WHY/HOW, not just WHAT - aim 4-8 sentences)",
      "example": "string (concrete example or analogy from real-world)",
      "keyPoints": ["string (actionable takeaways)"],
      "commonMisconception": "string (optional: what students often get wrong and why)"
    }
  ],
  "memoryTips": ["string (mnemonic devices, analogies, visualization cues)"],
  "selfCheckQuestions": ["string (2-3 questions students should ask themselves)"]
}

Quality standards:
- 4-7 sections (focused depth > breadth)
- Each section: explanation + concrete example + key takeaways
- Objectives use Bloom's verbs (explain, analyze, apply, compare)
- Memory tips linked to vivid imagery or existing knowledge
- Address 1-2 common misconceptions explicitly
- Self-check questions promote metacognition

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
          content: `Create 8 evidence-based quiz questions optimized for learning (not just testing).

Research principles:
- Retrieval Practice: questions should strengthen memory through active recall
- Desirable Difficulty: mix challenge levels to optimize learning
- Discrimination: distractors based on real misconceptions, not random wrong answers
- Elaboration: explanations teach, not just confirm right/wrong

Question design standards:
- CRITICAL: Each question must have EXACTLY 1 correct answer (no ambiguity)
- AVOID trivial recall ("What is X called?")
- PREFER application ("When would you use X?")
- PREFER conceptual understanding ("Why does X happen?")
- Distractors = wrong but reflect common student errors
- Make 1-2 distractors obviously wrong, 1-2 more subtle (not all equally plausible)
- Avoid ambiguous wording where multiple answers could be defended
- Balance answer positions (don't always make A or D correct)
- Vary question stems and formats for engagement

Mix cognitive levels:
- 2 remember/understand (foundational)
- 4 apply/analyze (transfer knowledge)
- 2 evaluate/synthesize (deeper reasoning)

JSON schema:
{
  "questions": [
    {
      "id": "q1",
      "question": "string (clear scenario or problem)",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string (must match one option exactly)",
      "explanation": "string (why correct + why common wrong answers fail - teach through feedback)",
      "concept": "string (which key concept this tests)",
      "difficulty": "foundational|application|advanced",
      "cognitiveLevel": "remember|understand|apply|analyze"
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
