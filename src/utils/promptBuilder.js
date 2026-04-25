import {
  prepareDocumentSlice,
  prepareTinyDocumentSlice,
  randomSeed
} from "./textUtils.js";

export function buildLearningPackPrompt(text, gameMode = "arena_mix") {
  const seed = randomSeed();
  const documentSlice = prepareDocumentSlice(text);

  return `
You are a strict university-level educational game designer.

Return ONLY valid JSON.
No markdown.
No prose outside JSON.

Language:
- Use the same main language as the document.
- If the document is Romanian, write Romanian.

Core rule:
Every challenge must be answerable by a player who sees ONLY:
1. the prompt
2. the visible answer options / pairs / steps
3. the mistakeText, if present

The player does NOT see the source document during the game.
Therefore:
- Do NOT ask questions that require hidden values from the source.
- Do NOT create math word problems unless ALL numbers needed for the calculation are inside the prompt.
- Do NOT invent prices, quantities, dates, names, formulas, or assumptions.
- If a value is not explicitly visible in the prompt/options, do not require it as the answer.
- sourceSnippet must contain the exact evidence from the document.
- explanation must not introduce new facts that are missing from prompt/sourceSnippet.

Ignore completely:
watermarks, page numbers, headers, footers, copyright notices, URLs, bibliography, image captions, decorative text, repeated boilerplate.

Quality rules:
- Each question must test a real concept from the document.
- Questions must be self-contained.
- Wrong options must be plausible but clearly wrong.
- Do NOT generate nonsense arithmetic unless the document is actually about that arithmetic.
- For code: ask about behavior, output, purpose, complexity, invariants, steps, or edge cases.
- For formulas: ask about meaning, variables, or calculations where all needed values are visible.

Game mode: ${gameMode}
Seed: ${seed}

Generate exactly 8 challenges:
- 2 × multiple_choice
- 1 × true_false
- 1 × fill_blank
- 1 × order_steps
- 1 × spot_mistake
- 1 × matching
- 1 × multiple_select

Field length limits:
- prompt: max 170 chars
- explanation: max 220 chars
- sourceSnippet: max 180 chars
- options / steps / pair items: max 100 chars
- concept: max 40 chars

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

Type rules:

multiple_choice:
- exactly 4 options
- exactly 1 correct option
- correctAnswer must be one of options
- Do NOT use multiple_choice if more than one option is true.
- Do NOT ask "which statements are true?" here. Use multiple_select instead.

true_false:
- options ["Adevărat","Fals"] or ["True","False"]
- correctAnswer must be one of options
- statement must be clearly true or false from the document

fill_blank:
- prompt contains exactly one blank token: ____
- options: []
- correctAnswer is only the missing word/phrase, not a full sentence
- acceptedAnswers includes synonyms/alternate forms
- Do NOT make a fill_blank math problem unless all needed values are visible in the prompt
- Bad example: "Vasile had 100 lei and bought notebooks and books. How much remains? ____" if prices are not in prompt.

order_steps:
- exactly 3 steps
- steps is shuffled
- correctOrder contains same exact 3 strings in correct order
- options: []

spot_mistake:
- mistakeText is a single wrong claim based on the document
- options exactly 4 explanations of the mistake
- correctAnswer one of options
- Do NOT glue multiple claims into one option

matching:
- prompt: "Match each item with its correct pair:" or Romanian equivalent
- pairs exactly 4 objects: { "left": "string", "right": "string" }
- options: []
- correctAnswer: ""

multiple_select:
- prompt MUST start with "Select ALL that apply:" or "Selectează TOATE variantele corecte:"
- options: 4 or 5 strings
- correctAnswers: 2 or 3 correct options, subset of options
- correctAnswer: ""
- Order of selected answers must not matter.

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

Validation error:
${validationError}

Hard requirements:
- exactly 8 challenges
- types: 2×multiple_choice, 1×true_false, 1×fill_blank, 1×order_steps, 1×spot_mistake, 1×matching, 1×multiple_select
- use only the document context
- no external knowledge
- no invented numbers
- every challenge must be self-contained
- sourceSnippet must contain the evidence
- explanations must not add facts missing from prompt/sourceSnippet

Very important:
- If a question has multiple correct options, it must be multiple_select, not multiple_choice.
- If a math question requires numbers, all needed numbers must appear in the prompt.
- If this cannot be guaranteed, replace the challenge with a conceptual one from the document.

Schema:
{
  "title": "string",
  "summary": "string",
  "concepts": ["string"],
  "challenges": [
    {
      "id": "c1",
      "type": "multiple_choice",
      "concept": "string",
      "difficulty": "easy",
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

Invalid JSON:
${String(badJson || "").slice(0, 4500)}

Document context:
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