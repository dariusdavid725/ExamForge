import { prepareDocumentSlice, prepareTinyDocumentSlice, randomSeed } from "./textUtils.js";

export function buildLearningPackPrompt(text, gameMode = "arena_mix") {
  const seed = randomSeed();
  const documentSlice = prepareDocumentSlice(text);

  return `
You are a professional educator creating a competitive quiz game from a document.
Think carefully before writing each question. Every question must be directly verifiable from the document text.

Language: Use the same language as the document. If Romanian, write in Romanian.

IGNORE completely: watermarks, page numbers, headers, footers, copyright notices, bibliography, URLs, image captions, decorative text, repeated boilerplate.

QUALITY RULES (read carefully):
- Each question must test a real concept from the document — not trivia or formatting.
- The correct answer must be unambiguously derivable from the document text shown.
- Wrong answer options must be plausible but clearly incorrect based on the document.
- Questions must be self-contained — the player should understand what is being asked without seeing the document.
- Do NOT ask about page numbers, authors, or document metadata.
- Do NOT use quotes longer than 60 characters in a prompt.
- Do NOT generate questions about information that only appears in removed/ignored sections.
- For code: ask about behavior, output, purpose, complexity — not syntax memorization.
- For math equations: ask about what the formula computes, its variables, or its result for given inputs.

Game mode: ${gameMode}
Seed: ${seed}

Generate exactly 8 challenges with this distribution:
- 2 × multiple_choice (4 options, exactly 1 correct)
- 1 × true_false
- 1 × fill_blank (prompt contains exactly one ____)
- 1 × order_steps (3 steps)
- 1 × spot_mistake
- 1 × matching (4 left-right pairs)
- 1 × multiple_select (4-5 options, 2-3 correct answers, prompt starts with "Select ALL that apply:")

Field length limits:
- prompt: max 160 chars
- explanation: max 200 chars
- sourceSnippet: max 150 chars
- options / left / right items: max 90 chars each
- concept: max 35 chars

JSON schema:
{
  "title": "string",
  "summary": "string",
  "concepts": ["string"],
  "challenges": [
    {
      "id": "c1",
      "type": "multiple_choice",
      "concept": "string",
      "difficulty": "easy|medium|hard",
      "prompt": "string",
      "options": ["string","string","string","string"],
      "correctAnswer": "string",
      "correctAnswers": [],
      "pairs": [],
      "acceptedAnswers": [],
      "steps": [],
      "correctOrder": [],
      "mistakeText": "",
      "explanation": "string",
      "sourceSnippet": "string"
    }
  ]
}

Type-specific rules:

multiple_choice: exactly 4 options, correctAnswer is one of them.

true_false:
  options: ["Adevărat","Fals"] (Romanian) or ["True","False"] (English)
  correctAnswer is one of them.

fill_blank:
  prompt contains exactly one ____.
  options: []
  acceptedAnswers: list of all valid phrasings (synonyms, abbreviations, alternate forms).
  The player types their answer — be generous with acceptedAnswers.

order_steps:
  exactly 3 steps.
  steps: shuffled list.
  correctOrder: same 3 strings in correct sequence.
  options: []

spot_mistake:
  mistakeText: a sentence with a factual error from the document.
  options: exactly 4 strings explaining what the mistake is.
  correctAnswer: one of the 4 options.

matching:
  prompt: "Match each item with its correct pair:" (or Romanian equivalent)
  pairs: exactly 4 objects, each { "left": "string", "right": "string" }
  options: []
  correctAnswer: ""
  The left items and right items will be shown shuffled to the player.

multiple_select:
  prompt MUST start with "Select ALL that apply:" (or Romanian: "Selectează TOATE variantele corecte:")
  options: 4 or 5 strings
  correctAnswers: array of 2 or 3 correct options (subset of options)
  correctAnswer: "" (leave empty)

DOCUMENT:
${documentSlice}
`;
}

export function buildRepairPrompt(badJson, validationError, text, gameMode = "arena_mix") {
  const documentContext = prepareTinyDocumentSlice(text);

  return `
Repair this learning pack JSON. Return ONLY valid JSON, no markdown.

Validation error: ${validationError}

Requirements:
- exactly 8 challenges
- types: 2×multiple_choice, 1×true_false, 1×fill_blank, 1×order_steps, 1×spot_mistake, 1×matching, 1×multiple_select
- base content only on the document below
- no external knowledge, no links

Schema per type:
multiple_choice: 4 options, correctAnswer one of them
true_false: 2 options, correctAnswer one of them
fill_blank: prompt has ____, options [], acceptedAnswers includes correctAnswer
order_steps: 3 steps, correctOrder same 3 strings in order
spot_mistake: mistakeText not empty, 4 options, correctAnswer one of them
matching: pairs array with 4 {left,right} objects, options [], correctAnswer ""
multiple_select: options array 4-5, correctAnswers array 2-3 (subset of options), correctAnswer ""

Every challenge must have ALL fields: id, type, concept, difficulty, prompt, options, correctAnswer, correctAnswers, pairs, acceptedAnswers, steps, correctOrder, mistakeText, explanation, sourceSnippet

Invalid JSON:
${String(badJson || "").slice(0, 4000)}

Document:
${documentContext}
`;
}

export function buildRecoveryLessonPrompt(room, player) {
  const wrongAnswers = player.answers
    .filter(a => !a.isCorrect)
    .map(a => {
      const challenge = room.pack.challenges[a.challengeIndex];
      return {
        type: challenge.type,
        concept: challenge.concept,
        prompt: challenge.prompt,
        mistakeText: challenge.mistakeText,
        selectedAnswer: a.selectedAnswer,
        correctAnswer: a.correctAnswer,
        explanation: challenge.explanation,
        sourceSnippet: challenge.sourceSnippet
      };
    });

  return `
Create a short recovery lesson based ONLY on missed challenges.

Rules:
- Same language as challenges.
- Only use provided data, no external knowledge, no links.
- Output ONLY valid JSON.
- Keep concise.

JSON schema:
{
  "title": "string",
  "summary": "string",
  "sections": [
    {
      "concept": "string",
      "whatWentWrong": "string",
      "miniLesson": "string",
      "memoryHook": "string",
      "retryChallenge": "string"
    }
  ]
}

MISSED CHALLENGES:
${JSON.stringify(wrongAnswers, null, 2)}
`;
}
