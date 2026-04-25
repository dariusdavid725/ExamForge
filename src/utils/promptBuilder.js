import { prepareDocumentSlice, prepareTinyDocumentSlice, randomSeed } from "./textUtils.js";

export function buildLearningPackPrompt(text, gameMode = "arena_mix") {
  const seed = randomSeed();
  const documentSlice = prepareDocumentSlice(text);

  return `
Generate an AI-only learning game pack from the document.

Language:
- Use the same main language as the document.
- If Romanian, write Romanian.

Rules:
- Use ONLY visible document text.
- Do NOT use links, URLs, bibliography, external references, or web knowledge.
- Do NOT invent facts.
- No raw broken code as answer options.
- If code exists, ask about behavior, complexity, invariants, steps, edge cases.
- Keep text concise.
- Output ONLY valid JSON.

Game mode: ${gameMode}
Seed: ${seed}

Generate exactly 8 challenges.
Required types:
- 2 multiple_choice
- 1 true_false
- 1 fill_blank
- 1 order_steps
- 1 spot_mistake
- 2 any useful type from the allowed list

Allowed types:
multiple_choice, true_false, fill_blank, order_steps, spot_mistake

Short field rules:
- prompt max 150 chars.
- explanation max 180 chars.
- sourceSnippet max 140 chars.
- options max 80 chars each.
- concept max 35 chars.
- For fill_blank, prompt must contain ____.
- For order_steps, use 3 steps only.
- For spot_mistake, mistakeText must be a wrong claim; options explain the mistake.

IMPORTANT:
Every challenge must include ALL fields from the schema.
For spot_mistake, options MUST have exactly 4 strings.
For multiple_choice, options MUST have exactly 4 strings.
For true_false, options MUST have exactly 2 strings.

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
      "difficulty": "easy",
      "prompt": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "acceptedAnswers": [],
      "steps": [],
      "correctOrder": [],
      "mistakeText": "",
      "explanation": "string",
      "sourceSnippet": "string"
    }
  ]
}

For true_false:
- Romanian options: ["Adevărat", "Fals"]
- English options: ["True", "False"]

For fill_blank:
- options: []
- acceptedAnswers must include correctAnswer.

For order_steps:
- steps must be shuffled.
- correctOrder must contain the same exact strings in correct order.

DOCUMENT:
${documentSlice}
`;
}

export function buildRepairPrompt(badJson, validationError, text, gameMode = "arena_mix") {
  const documentContext = prepareTinyDocumentSlice(text);

  return `
Repair this AI-generated learning pack.

The previous output was invalid.

Validation error:
${validationError}

Your task:
- Return a COMPLETE valid JSON object.
- Keep the content based ONLY on the document context below.
- Do NOT use external knowledge.
- Do NOT use links.
- Do NOT explain.
- No markdown.
- JSON only.

Game mode: ${gameMode}

Requirements:
- exactly 8 challenges
- at least 2 multiple_choice
- at least 1 true_false
- at least 1 fill_blank
- at least 1 order_steps
- at least 1 spot_mistake

Strict schema:
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
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "acceptedAnswers": [],
      "steps": [],
      "correctOrder": [],
      "mistakeText": "",
      "explanation": "string",
      "sourceSnippet": "string"
    }
  ]
}

Type constraints:
- multiple_choice: exactly 4 options, correctAnswer one of them
- true_false: exactly 2 options, correctAnswer one of them
- fill_blank: prompt contains ____, options [], acceptedAnswers includes correctAnswer
- order_steps: 3 steps, correctOrder has the same 3 exact strings in correct order
- spot_mistake: mistakeText not empty, exactly 4 options, correctAnswer one of them

Invalid previous output:
${String(badJson || "").slice(0, 5500)}

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
- Use same language as challenges.
- Use only provided data.
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

MISSED:
${JSON.stringify(wrongAnswers, null, 2)}
`;
}
