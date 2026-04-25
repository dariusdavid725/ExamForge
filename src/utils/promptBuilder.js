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
- If Romanian, write Romanian.

CRITICAL QUALITY RULES:
Every challenge must be self-contained.
The player will NOT see the document while answering.
The player only sees:
- prompt
- options / pairs / steps
- mistakeText, if present

So:
- Do NOT ask for hidden values from the document.
- Do NOT invent numbers, prices, quantities, examples, dates, names, or formulas.
- Do NOT create math word problems unless ALL numbers needed are visible in the prompt.
- Do NOT create sequence questions like "from 12 to ____" unless the missing value is directly visible and obvious from the prompt.
- Do NOT ask "which statements are true?" as multiple_choice. Use multiple_select.
- Do NOT put multiple statements glued into one option.
- Do NOT make one option contain a list separated by many commas.
- Each sourceSnippet must support the answer.
- Explanation must not introduce new facts missing from prompt/sourceSnippet.

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
- prompt max 170 chars
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

fill_blank:
- prompt contains exactly one blank token: ____
- options []
- correctAnswer is only the missing word/phrase
- acceptedAnswers contains valid alternatives
- do NOT ask incomplete math/sequence questions
- bad: "Scrieți numerele din 3 în 3 de la 12 până la ____"
- good: "Următorul număr după 12, 15, 18 este ____"

order_steps:
- exactly 3 steps
- steps shuffled
- correctOrder has same exact 3 steps in correct order
- options []

spot_mistake:
- mistakeText is one wrong claim
- options exactly 4 explanations
- correctAnswer one of options

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

export function buildAuditPrompt(text, pack) {
  const documentContext = prepareTinyDocumentSlice(text);

  return `
You are a strict QA auditor for educational quiz packs.

Return ONLY valid JSON.

Check if the pack is safe to show to students.

Mark valid=false if ANY challenge:
- is not self-contained
- requires hidden values from the document
- invents facts, numbers, examples, prices, quantities, formulas
- has a fill_blank where the missing answer cannot be inferred from prompt alone
- has a math question without all needed values in prompt
- has a multiple_choice with more than one correct option
- should be multiple_select but is multiple_choice
- has options glued together or confusing
- has sourceSnippet that does not support the answer

JSON schema:
{
  "valid": true,
  "problems": ["string"]
}

DOCUMENT:
${documentContext}

PACK:
${JSON.stringify(pack, null, 2)}
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
- no hidden values
- no incomplete math or sequence questions
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