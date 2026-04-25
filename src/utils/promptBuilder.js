import {
  prepareDocumentSlice,
  prepareTinyDocumentSlice,
  randomSeed
} from "./textUtils.js";

export function buildLearningPackPrompt(text, gameMode = "arena_mix") {
  const seed = randomSeed();
  const documentSlice = prepareDocumentSlice(text);

  return `
You are a strict educational game designer.

Return ONLY valid JSON.
No markdown.
No prose outside JSON.

Language:
- Use the same main language as the document.
- If the document is Romanian, write Romanian.

CRITICAL RULE:
Every challenge must be SELF-CONTAINED.

The player will NOT see the document.
The player will ONLY see:
- prompt
- options / pairs / steps
- mistakeText, if present

Therefore:
- Do NOT reference hidden source positions.
- Forbidden: "line 10", "linia 10", "rândul 3", "pagina 4", "slide 2", "codul de mai sus", "fragmentul de mai sus", "în document".
- If you need to ask about a code line, include the actual code operation in the prompt.
- Bad: "Linia 10 actualizează părintele lui x dacă x nu este NIL."
- Good: "Instrucțiunea x.parent = y.parent se execută doar dacă x != NIL."
- Do NOT ask questions that require seeing a hidden snippet.
- Do NOT invent numbers, examples, prices, quantities, dates, names, formulas, or assumptions.
- Do NOT create math word problems unless ALL needed numbers are visible in the prompt.
- Do NOT ask "which statements are true?" as multiple_choice. Use multiple_select.
- Do NOT put multiple statements glued into one option.
- Do NOT make one option contain a long comma-separated list.
- sourceSnippet must support the answer, but the answer must still be inferable from the visible prompt/options.

Use ONLY the document.
Ignore watermarks, headers, footers, page numbers, URLs, bibliography, copyright notices.

Game mode: ${gameMode}
Seed: ${seed}

Generate exactly 8 challenges:
- 2 multiple_choice
- 1 true_false
- 1 fill_blank
- 1 order_steps
- 1 spot_mistake
- 1 matching
- 1 multiple_select

Field limits:
- prompt max 180 chars
- explanation max 220 chars
- sourceSnippet max 180 chars
- options max 100 chars each
- concept max 40 chars

Root JSON:
{
  "title": "string",
  "summary": "string",
  "category": "string",
  "concepts": ["string"],
  "challenges": []
}

Challenge object:
{
  "id": "c1",
  "type": "multiple_choice",
  "concept": "string",
  "difficulty": "easy",
  "prompt": "string",
  "options": ["string"],
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

Type rules:

multiple_choice:
- exactly 4 options
- exactly 1 correct answer
- correctAnswer must be one of options
- do NOT use if 2+ options are correct

true_false:
- options ["Adevărat","Fals"] or ["True","False"]
- correctAnswer must be one option
- prompt must be a complete statement, not a reference to a hidden line

fill_blank:
- prompt contains exactly one blank token: ____
- options []
- correctAnswer is only the missing word/phrase
- acceptedAnswers contains valid alternatives
- do NOT ask incomplete math/sequence questions

order_steps:
- exactly 3 steps
- steps shuffled
- correctOrder has same exact 3 steps in correct order
- options []

spot_mistake:
- mistakeText is one wrong claim
- options exactly 4 explanations
- correctAnswer one of options
- mistakeText must not reference hidden lines/pages/snippets

matching:
- pairs exactly 4 objects { "left": "string", "right": "string" }
- options []
- correctAnswer ""

multiple_select:
- prompt starts with "Selectează TOATE variantele corecte:" or "Select ALL that apply:"
- options 4 or 5 strings
- correctAnswers 2 or 3 strings, subset of options
- correctAnswer ""
- order must not matter

DOCUMENT:
${documentSlice}
`;
}

export function buildRepairPrompt(badJson, validationError, text, gameMode = "arena_mix") {
  const documentContext = prepareTinyDocumentSlice(text);

  return `
Repair this learning pack JSON.

Return ONLY valid JSON.
No markdown.
No prose outside JSON.

Reason it failed:
${validationError}

Hard requirements:
- exactly 8 challenges
- 2 multiple_choice
- 1 true_false
- 1 fill_blank
- 1 order_steps
- 1 spot_mistake
- 1 matching
- 1 multiple_select
- every challenge must be self-contained
- use only the document
- no invented facts
- no hidden source references
- no "linia X", "line X", "pagina X", "codul de mai sus", "fragmentul de mai sus"
- if a question mentions a code operation, include the actual operation in the prompt
- if a question has multiple correct answers, make it multiple_select

Root JSON:
{
  "title": "string",
  "summary": "string",
  "category": "string",
  "concepts": ["string"],
  "challenges": []
}

Every challenge must include:
id, type, concept, difficulty, prompt, options, correctAnswer, correctAnswers, pairs, acceptedAnswers, steps, correctOrder, mistakeText, explanation, sourceSnippet

Previous invalid JSON:
${String(badJson || "").slice(0, 4500)}

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
- Only use provided data.
- No external knowledge.
- No links.
- Output ONLY valid JSON.

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

MISSED:
${JSON.stringify(wrongAnswers, null, 2)}
`;
}