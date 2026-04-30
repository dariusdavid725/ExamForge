import {
  prepareDocumentSlice,
  prepareTinyDocumentSlice,
  randomSeed
} from "./textUtils.js";

/** Repair used to slice JSON at 5k chars — later challenges (e.g. c8) were missing. Prefer full/minified pack. */
export function formatPackJsonForRepair(badJson, maxChars = 120000) {
  const raw = String(badJson || "").trim();
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  try {
    const pack = JSON.parse(raw);
    const compact = JSON.stringify(pack);
    if (compact.length <= maxChars) return compact;
  } catch {
    /* fall through */
  }
  return raw.slice(0, maxChars) + "\n/* truncated: increase source or split */";
}

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

Generate exactly 8 challenges using Bloom's Taxonomy progression:

Cognitive levels (mix across challenges, NOT rigid progression):
- Remember (1-2): recall facts, terms, concepts
- Understand (2-3): explain ideas, compare, classify
- Apply (2-3): use concepts in new situations, solve problems
- Analyze (1-2): break down, identify patterns, cause-effect
- IMPORTANT: Don't put all easy first then all hard. Mix difficulty throughout.

Challenge distribution (EXACTLY 8 total):
- 2 multiple_choice (focus on misconceptions, not trivial recall)
- 1 true_false (test deep understanding, not surface facts)
- 1 fill_blank (key terms in meaningful context)
- 1 order_steps (procedural knowledge, cause-effect)
- 1 spot_mistake (error analysis, critical thinking)
- 1 matching (conceptual relationships)
- 1 multiple_select (integration, multiple correct principles)

Quality rules (research-based):
- CRITICAL: For multiple_choice, EXACTLY 1 answer must be correct, others must be CLEARLY wrong
- If 2+ options could be correct, use multiple_select instead (NOT multiple_choice)
- Distractors should be wrong but based on common student errors
- Make 1-2 distractors obviously wrong, 1-2 more subtle (graduated difficulty)
- Avoid pattern giveaways:
  * Don't make correct answer always the longest/most detailed
  * Don't use "all of the above" or "none of the above"
  * Balance correct answer positions (A, B, C, D equally likely)
- Questions require understanding, not just recognition
- Include "why" in explanations (why correct + why others are wrong)
- Use concrete examples from document
- Avoid ambiguous wording that makes multiple answers defensible
- VARY question formats and styles (don't be predictable or formulaic)

Field guidelines (aim for clarity, not arbitrary limits):
- prompt: clear, self-contained question (aim 60-200 chars)
- explanation: why the answer is correct + why distractors are wrong (aim 150-300 chars)
- sourceSnippet: supporting evidence from document (aim 80-250 chars)
- options: distinct, plausible distractors based on common misconceptions (aim 40-150 chars each)
- concept: specific learning objective (aim 20-60 chars)

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
- EXACTLY 1 correct answer (others must be CLEARLY wrong)
- correctAnswer must be one of options
- do NOT use if 2+ options could be considered correct
- If unsure, make question more specific or use multiple_select

Example GOOD multiple_choice:
Q: "Care este rolul principal al clorofilei în fotosinteză?"
A: "Absoarbe lumina solară" ✓ CORRECT
B: "Produce oxigen" ✗ (oxigenul e produs, dar nu de clorofilă direct)
C: "Descompune apa" ✗ (apa e descompusă de alt proces)
D: "Fixează carbonul" ✗ (fixarea e în Calvin cycle)

Example BAD (ambiguous):
Q: "Ce face cloroplastul?"
A: "Produce energie" ← Could be defended (ATP)
B: "Face fotosinteză" ← Also correct!
(This should be multiple_select OR more specific question)

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
- steps shuffled (not in correct order in the "steps" array)
- correctOrder has same exact 3 steps in LOGICAL correct order
- CRITICAL: Steps must have CLEAR logical sequence (chronological, causal, procedural)
- CRITICAL: correctOrder must contain EXACT same text as steps (just reordered)
- Each step must be distinct and meaningful
- Avoid ambiguous ordering where multiple sequences could be correct
- options []

Example GOOD order_steps:
{
  "steps": ["Mix ingredients", "Preheat oven to 180°C", "Bake for 30 minutes"],
  "correctOrder": ["Preheat oven to 180°C", "Mix ingredients", "Bake for 30 minutes"]
}
✓ Same exact strings, just reordered

Example BAD (text mismatch):
{
  "steps": ["Mix ingredients well", "Preheat oven", "Bake"],
  "correctOrder": ["Preheat oven to 180°C", "Mix ingredients", "Bake for 30 minutes"]
}
❌ Different text! correctOrder must use exact strings from steps array

Example BAD (ambiguous order):
{
  "steps": ["Study biology", "Study chemistry", "Study physics"]
}
❌ No clear logical sequence (these can happen in any order)

spot_mistake:
- mistakeText is one wrong visible claim
- options exactly 4 explanations
- correctAnswer one of options
- mistakeText must include the relevant operation/statement if it depends on code

matching:
- pairs exactly 4 objects { "left": "string", "right": "string" }
- CRITICAL: left and right must be DIFFERENT (no duplicates like "Mitochondria" → "Mitochondria")
- All left values must be unique (no repeats)
- All right values must be unique (no repeats)
- Each pair must make logical sense (term → definition, cause → effect, concept → example)
- options []
- correctAnswer ""

multiple_select:
- prompt starts with "Selectează TOATE variantele corecte:" or "Select ALL that apply:"
- options 4 or 5 strings
- correctAnswers 2 or 3 strings, subset of options
- correctAnswer ""
- order must not matter
- CRITICAL: Each option must be objectively true or false for the prompt — no two options that mean the same thing with different wording
- CRITICAL: If the task fits a single best answer only, use multiple_choice (one correct), not multiple_select
- CRITICAL: For any arithmetic or equality in an option, verify it (e.g. 15+12=27 is TRUE; do not mark it incorrect in explanation)
- explanation must match correctAnswers: never claim a true statement is false or vice versa; re-check all sums and facts before output

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

Generate exactly 8 challenges using Bloom's Taxonomy progression:

Cognitive levels (mix across challenges, NOT rigid progression):
- Remember (1-2): recall facts, terms, concepts
- Understand (2-3): explain ideas, compare, classify
- Apply (2-3): use concepts in new situations, solve problems
- Analyze (1-2): break down, identify patterns, cause-effect
- IMPORTANT: Don't put all easy first then all hard. Mix difficulty throughout.

Challenge distribution (EXACTLY 8 total):
- 2 multiple_choice (focus on misconceptions, not trivial recall)
- 1 true_false (test deep understanding, not surface facts)
- 1 fill_blank (key terms in meaningful context)
- 1 order_steps (procedural knowledge, cause-effect)
- 1 spot_mistake (error analysis, critical thinking)
- 1 matching (conceptual relationships)
- 1 multiple_select (integration, multiple correct principles)

Quality rules (research-based):
- CRITICAL: For multiple_choice, EXACTLY 1 answer must be correct, others must be CLEARLY wrong
- If 2+ options could be correct, use multiple_select instead (NOT multiple_choice)
- Distractors should be wrong but based on common student errors
- Make 1-2 distractors obviously wrong, 1-2 more subtle (graduated difficulty)
- Avoid pattern giveaways:
  * Don't make correct answer always the longest/most detailed
  * Don't use "all of the above" or "none of the above"
  * Balance correct answer positions (A, B, C, D equally likely)
- Questions require understanding, not just recognition
- Include "why" in explanations (why correct + why others are wrong)
- Use concrete examples from the topic
- Avoid ambiguous wording that makes multiple answers defensible
- VARY question formats and styles (don't be predictable or formulaic)

Field guidelines (aim for clarity, not arbitrary limits):
- prompt: clear, self-contained question (aim 60-200 chars)
- explanation: why the answer is correct + why distractors are wrong (aim 150-300 chars)
- sourceSnippet: supporting fact or principle (aim 80-250 chars)
- options: distinct, plausible distractors based on common misconceptions (aim 40-150 chars each)
- concept: specific learning objective (aim 20-60 chars)

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
- EXACTLY 1 correct answer (others must be CLEARLY wrong)
- correctAnswer must be one of options
- do NOT use if 2+ options could be considered correct
- Make 1-2 options obviously wrong, 1-2 more subtle

Example GOOD:
Q: "What is the primary function of mitochondria?"
A: "Produce ATP through cellular respiration" ✓
B: "Synthesize proteins" ✗ (that's ribosomes)
C: "Store genetic material" ✗ (too vague, main function is energy)
D: "Digest cellular waste" ✗ (that's lysosomes)

Example BAD (multiple correct):
Q: "What does the heart do?"
A: "Pumps blood" ← Correct
B: "Circulates oxygen" ← Also technically correct!
(Make question more specific or use multiple_select)

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
- steps shuffled (not in correct order in the "steps" array)
- correctOrder has same exact 3 steps in LOGICAL correct order
- CRITICAL: Steps must have CLEAR logical sequence (chronological, causal, procedural)
- CRITICAL: correctOrder must contain EXACT same text as steps (just reordered)
- Each step must be distinct and meaningful
- Avoid ambiguous ordering where multiple sequences could be correct
- options []

Example GOOD order_steps:
{
  "steps": ["Electron transport chain", "Glycolysis", "Krebs cycle"],
  "correctOrder": ["Glycolysis", "Krebs cycle", "Electron transport chain"]
}
✓ Same exact strings, just reordered

Example BAD (text mismatch):
{
  "steps": ["Electron transport", "Glycolysis process", "Krebs cycle"],
  "correctOrder": ["Glycolysis", "Krebs cycle", "Electron transport chain"]
}
❌ Different text! correctOrder must use exact strings from steps array

Example BAD (no clear order):
{
  "steps": ["Drink water", "Exercise", "Sleep"]
}
❌ These can happen in any order (no clear sequence)

spot_mistake:
- mistakeText is one wrong visible claim about the topic
- options exactly 4 explanations of what is wrong
- correctAnswer one of options

matching:
- pairs exactly 4 objects { "left": "string", "right": "string" }
- CRITICAL: left and right must be DIFFERENT (no duplicates like "Mitochondria" → "Mitochondria")
- All left values must be unique (no repeats)
- All right values must be unique (no repeats)
- Each pair must make logical sense (term → definition, cause → effect, concept → example)
- options []
- correctAnswer ""

multiple_select:
- prompt starts with "Select ALL that apply:" or equivalent in the detected language
- options 4 or 5 strings
- correctAnswers 2 or 3 strings, subset of options
- correctAnswer ""
- CRITICAL: Each option objectively true or false; use multiple_choice if only one answer is correct
- CRITICAL: Verify arithmetic/equalities in options; explanation must align with correctAnswers (no contradictions)
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
Fix every challenge mentioned in the error (e.g. c8). If multiple_select is ambiguous or the explanation contradicts the math, rewrite options and correctAnswers so they are unambiguous, or change type to multiple_choice if only one option should be correct.

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
${formatPackJsonForRepair(badJson)}

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
- CRITICAL: has a multiple_choice where 2 or more options could be considered correct (ambiguous question)
- has a multiple_choice where all 4 options are equally plausible (needs clearer wrong answers)
- should be multiple_select but is multiple_choice
- CRITICAL: multiple_select where only one option is truly correct (should be multiple_choice) OR correctAnswers/explanation contradict the facts (e.g. explanation says a true arithmetic equality is false)
- has options glued together or confusing
- has sourceSnippet that does not support the answer
- has ambiguous wording that makes the question unclear
- MATCHING ERRORS:
  * has matching where left === right (duplicate like "Mitochondria" → "Mitochondria")
  * has matching where same left value appears twice
  * has matching where same right value appears twice
  * has matching pairs that don't make logical sense
- ORDER_STEPS ERRORS:
  * has order_steps where sequence is ambiguous (multiple valid orders)
  * has order_steps where steps don't have clear chronological/causal/procedural relationship
  * has order_steps already in correct order in "steps" array (should be shuffled)
  * CRITICAL: has order_steps where correctOrder contains different text than steps array
  * correctOrder must contain EXACT same strings as steps array, just in different order

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
Create a personalized recovery lesson based on cognitive learning principles.

Research-based approach:
1. Error Analysis: identify the specific misconception (not just "you got it wrong")
2. Elaborative Interrogation: explain WHY the correct answer works
3. Dual Coding: provide concrete examples or analogies
4. Retrieval Practice: suggest self-testing strategy
5. Growth Mindset: frame errors as learning opportunities

Rules:
- Same language as challenges
- Only use provided data
- No external knowledge
- No links
- Output ONLY valid JSON
- Be encouraging but honest

JSON schema:
{
  "title": "string",
  "summary": "string (encouraging, growth-mindset framing)",
  "sections": [
    {
      "concept": "string",
      "misconceptionIdentified": "string (what specific thinking error occurred)",
      "whyItMatters": "string (why understanding this concept is important)",
      "correctUnderstanding": "string (clear explanation with WHY/HOW, 3-5 sentences)",
      "concreteExample": "string (real-world analogy or visualization)",
      "memoryHook": "string (vivid mnemonic or retrieval cue)",
      "selfTestPrompt": "string (question to ask yourself to check understanding)"
    }
  ],
  "nextSteps": ["string (2-3 actionable study recommendations)"]
}

MISSED CHALLENGES:
${JSON.stringify(wrongAnswers, null, 2)}
`;
}