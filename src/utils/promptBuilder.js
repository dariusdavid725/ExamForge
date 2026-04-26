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

Core rule:
Every challenge must be SELF-CONTAINED.

The player will NOT see the document.
The player will ONLY see:
- prompt
- options / pairs / steps
- mistakeText, if present

Hidden-reference rule:
- Do NOT ask about a hidden line number, page number, slide number, or "text above".
- If the source uses a line number or code fragment, include the relevant visible operation/code directly in the question.
- Never write "linia 10" or "line 10" in the visible challenge.
- Instead write the actual operation or statement.

Examples:
Bad:
"Identifică greșeala: Dacă x este NIL, atunci linia 10 setează x.parent la y.parent."

Good:
"Identifică greșeala: Dacă x este NIL, instrucțiunea x.parent = y.parent nu trebuie executată."

Good:
"Pentru secvența x.parent = y.parent, când este sigură actualizarea părintelui lui x?"

If you cannot include the referenced sequence clearly:
- choose another concept from the document
- generate a different self-contained challenge

Use ONLY the document.
Do NOT invent facts, examples, numbers, quantities, names, formulas, or assumptions.
Do NOT create math word problems unless ALL needed values are visible in the prompt.
Do NOT ask "which statements are true?" as multiple_choice. Use multiple_select.
Do NOT put multiple unrelated statements in one option.
Do NOT make one option contain a long comma-separated list.
sourceSnippet must support the answer, but the answer must still be inferable from the visible prompt/options.

Ignore:
- watermarks
- headers
- footers
- page numbers
- URLs
- bibliography
- copyright notices
- decorative text
- repeated boilerplate

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
- prompt must be a complete visible statement

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
- mistakeText is one wrong visible claim
- options exactly 4 explanations
- correctAnswer one of options
- mistakeText must include the relevant operation/statement if it depends on code

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

// ─── Topic-based pack prompt ──────────────────────────────────────────────────
// Used when the user types a topic (e.g. "crypto") instead of uploading a document.
// The AI uses its own knowledge; no document extraction constraint applies.

export function buildTopicPackPrompt(topic, gameMode = "arena_mix") {
  const seed = randomSeed();

  return `
You are an expert educational game designer.

Return ONLY valid JSON.
No markdown.
No prose outside JSON.

Topic requested by the user: "${topic}"

Language:
- Detect the language of the topic text and write everything in that language.
- If the topic is in Romanian, write Romanian. If in English, write English.

Core rule:
Every challenge must be SELF-CONTAINED.
The player will ONLY see the prompt, options, pairs, steps, or mistakeText.
Use your knowledge to generate accurate, educational challenges about the topic.

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
- sourceSnippet: brief fact that supports the answer (max 180 chars)
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

true_false:
- options ["Adevărat","Fals"] or ["True","False"] depending on language
- correctAnswer must be one option
- prompt must be a complete statement

fill_blank:
- prompt contains exactly one blank: ____
- options []
- correctAnswer is only the missing word/phrase
- acceptedAnswers contains valid alternatives

order_steps:
- exactly 3 steps
- steps shuffled
- correctOrder has same 3 steps in correct order
- options []

spot_mistake:
- mistakeText is one wrong visible claim about the topic
- options exactly 4 explanations of what is wrong
- correctAnswer one of options

matching:
- pairs exactly 4 objects { "left": "string", "right": "string" }
- options []
- correctAnswer ""

multiple_select:
- prompt starts with "Select ALL that apply:" or equivalent in the detected language
- options 4 or 5 strings
- correctAnswers 2 or 3 strings, subset of options
- correctAnswer ""
`;
}

export function buildRepairPrompt(
  badJson,
  validationError,
  text,
  gameMode = "arena_mix",
  repairAttempt = 1
) {
  const documentContext = prepareTinyDocumentSlice(text);

  return `
Repair this learning pack JSON.

Return ONLY valid JSON.
No markdown.
No prose outside JSON.

Reason it failed:
${validationError}

Important:
Do NOT reject the document.
Do NOT remove the whole pack.
Fix the invalid challenge.

If the problem is a hidden source reference such as "linia 10", "line 10", "pagina 4", "fragmentul de mai sus":
1. First try to make the challenge self-contained by including the actual relevant sequence/operation/statement in prompt or mistakeText.
2. Remove the line/page/slide reference.
3. If the relevant sequence cannot be identified clearly, replace only that challenge with another self-contained challenge from the document.

Bad:
"Identifică greșeala: Dacă x este NIL, atunci linia 10 setează x.parent la y.parent."

Good:
"Identifică greșeala: Dacă x este NIL, instrucțiunea x.parent = y.parent nu trebuie executată."

Good:
"Pentru secvența x.parent = y.parent, când este corectă actualizarea părintelui lui x?"

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
- no "linia X"
- no "line X"
- no "pagina X"
- no "page X"
- no "slide X"
- no "codul de mai sus"
- no "fragmentul de mai sus"
- no "textul de mai sus"
- if a question mentions code, include the actual operation in the visible prompt/mistakeText
- if a question has multiple correct answers, make it multiple_select

Game mode: ${gameMode}
Repair attempt: ${repairAttempt}

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
${String(badJson || "").slice(0, 5000)}

Document:
${documentContext}
`;
}

export function buildAuditPrompt(text, pack) {
  const documentContext = prepareTinyDocumentSlice(text);

  return `
You are a strict QA auditor for educational quiz packs.

Return ONLY valid JSON.
No markdown.
No prose outside JSON.

Check if this pack is safe to show to students.

Mark valid=false if ANY challenge:
- is not self-contained
- requires the player to see hidden document content
- references hidden source positions such as "line 10", "linia 10", "pagina 4", "slide 2", "codul de mai sus", "fragmentul de mai sus"
- invents facts, numbers, examples, prices, quantities, dates, names, formulas, or assumptions
- has a fill_blank where the missing answer cannot be inferred from prompt alone
- has a math question without all needed values in prompt
- has a multiple_choice with more than one correct option
- should be multiple_select but is multiple_choice
- has options glued together or confusing
- has sourceSnippet that does not support the answer

Important:
- The player sees ONLY prompt/options/steps/pairs/mistakeText.
- The player does NOT see sourceSnippet while answering.
- sourceSnippet is only evidence for audit/history.
- If a challenge originally came from a line/page/code reference, the visible prompt/mistakeText must include the actual relevant operation or statement.

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

export function buildRecoveryLessonPrompt(room, player) {
  const wrongAnswers = player.answers
    .filter(answer => !answer.isCorrect)
    .map(answer => {
      const challenge = room.pack.challenges[answer.challengeIndex];

      return {
        type: challenge.type,
        concept: challenge.concept,
        prompt: challenge.prompt,
        mistakeText: challenge.mistakeText,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: answer.correctAnswer,
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