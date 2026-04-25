import { normalizeString, shuffleArray } from "../utils/textUtils.js";

function normalizeConcepts(concepts) {
  if (!Array.isArray(concepts)) return ["Concepte principale"];

  const normalized = concepts
    .map(item => {
      if (typeof item === "string") return item;

      if (item && typeof item.name === "string") {
        return item.name;
      }

      return "";
    })
    .map(item => item.trim())
    .filter(Boolean);

  return normalized.length > 0
    ? normalized.slice(0, 8)
    : ["Concepte principale"];
}

function uniqueArray(array) {
  return [...new Set(array.map(normalizeString).filter(Boolean))];
}

function enforceSingleBlank(prompt) {
  let result = normalizeString(prompt).replace(/_{2,}/g, "____");
  const parts = result.split("____");

  if (parts.length <= 2) return result;

  return (
    parts[0] +
    "____" +
    parts
      .slice(1)
      .join(" ")
      .replace(/____/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function countNumbers(text) {
  const matches = String(text || "").match(/-?\d+([.,]\d+)?/g);

  return matches ? matches.length : 0;
}

function asksForMultipleAnswers(text) {
  const value = String(text || "").toLowerCase();

  return [
    "select all",
    "all that apply",
    "which statements are true",
    "which of the following are",
    "selectează toate",
    "selecteaza toate",
    "toate variantele",
    "care dintre afirmațiile",
    "care dintre afirmatiile",
    "sunt adevărate",
    "sunt adevarate",
    "sunt corecte"
  ].some(fragment => value.includes(fragment));
}

function looksLikeCalculationQuestion(text) {
  const value = String(text || "").toLowerCase();

  return [
    "cât",
    "cat",
    "câți",
    "cati",
    "câte",
    "cate",
    "lei",
    "bani",
    "rămân",
    "raman",
    "calculează",
    "calculeaza",
    "total",
    "sumă",
    "suma",
    "remaining",
    "calculate"
  ].some(word => value.includes(word));
}

function looksLikeBrokenSequenceQuestion(text) {
  const value = String(text || "").toLowerCase();

  if (/(până|pana)\s+la\s+____/.test(value)) return true;
  if (/de\s+la\s+.+(până|pana)\s+la\s+____/.test(value)) return true;
  if (/din\s+\d+\s+(în|in)\s+\d+.+____/.test(value)) return true;

  return false;
}

function hasBadOptionShape(option) {
  const value = normalizeString(option);

  if (!value) return true;
  if (value.length > 170) return true;

  const commaCount = (value.match(/,/g) || []).length;
  const mathSigns = (value.match(/[<>+=×x*]/g) || []).length;

  if (commaCount >= 3 && mathSigns >= 3) return true;

  return false;
}

function validateFillBlank(challenge, index) {
  challenge.prompt = enforceSingleBlank(challenge.prompt);

  if (!challenge.prompt.includes("____")) {
    throw new Error(`Fill blank ${index + 1} must contain ____.`);
  }

  if (!challenge.correctAnswer) {
    throw new Error(`Fill blank ${index + 1} needs correctAnswer.`);
  }

  if (looksLikeBrokenSequenceQuestion(challenge.prompt)) {
    throw new Error(`Fill blank ${index + 1} is an incomplete sequence question.`);
  }

  if (looksLikeCalculationQuestion(challenge.prompt) && countNumbers(challenge.prompt) < 2) {
    throw new Error(`Fill blank ${index + 1} is not self-contained.`);
  }

  if (!challenge.sourceSnippet || challenge.sourceSnippet.length < 12) {
    throw new Error(`Fill blank ${index + 1} needs useful sourceSnippet.`);
  }
}

function normalizeChallenge(raw, index) {
  const type = normalizeString(raw.type);

  const allowedTypes = [
    "multiple_choice",
    "true_false",
    "fill_blank",
    "order_steps",
    "spot_mistake",
    "matching",
    "multiple_select"
  ];

  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid challenge type at ${index + 1}: ${type}`);
  }

  const challenge = {
    id: `c${index + 1}`,
    type,
    concept: normalizeString(raw.concept) || "Concept",
    difficulty: ["easy", "medium", "hard"].includes(normalizeString(raw.difficulty))
      ? normalizeString(raw.difficulty)
      : "medium",
    prompt: normalizeString(raw.prompt),
    options: Array.isArray(raw.options) ? uniqueArray(raw.options) : [],
    correctAnswer: normalizeString(raw.correctAnswer),
    correctAnswers: Array.isArray(raw.correctAnswers)
      ? uniqueArray(raw.correctAnswers)
      : [],
    pairs: Array.isArray(raw.pairs)
      ? raw.pairs
          .map(p => ({
            left: normalizeString(p?.left),
            right: normalizeString(p?.right)
          }))
          .filter(p => p.left && p.right)
      : [],
    acceptedAnswers: Array.isArray(raw.acceptedAnswers)
      ? uniqueArray(raw.acceptedAnswers)
      : [],
    steps: Array.isArray(raw.steps) ? uniqueArray(raw.steps) : [],
    correctOrder: Array.isArray(raw.correctOrder)
      ? uniqueArray(raw.correctOrder)
      : [],
    mistakeText: normalizeString(raw.mistakeText),
    explanation: normalizeString(raw.explanation),
    sourceSnippet: normalizeString(raw.sourceSnippet)
  };

  if (!challenge.prompt && type !== "spot_mistake") {
    throw new Error(`Challenge ${index + 1} has no prompt.`);
  }

  if (type === "multiple_choice") {
    if (asksForMultipleAnswers(challenge.prompt)) {
      throw new Error(`Multiple choice ${index + 1} asks for multiple answers.`);
    }

    challenge.options = challenge.options.filter(option => !hasBadOptionShape(option));

    if (challenge.options.length !== 4) {
      throw new Error(`Multiple choice ${index + 1} must have 4 clean options.`);
    }

    if (!challenge.options.includes(challenge.correctAnswer)) {
      throw new Error(`Multiple choice ${index + 1} correctAnswer must be one option.`);
    }
  }

  if (type === "true_false") {
    if (challenge.options.length !== 2) {
      throw new Error(`True/false ${index + 1} must have 2 options.`);
    }

    if (!challenge.options.includes(challenge.correctAnswer)) {
      throw new Error(`True/false ${index + 1} correctAnswer must be one option.`);
    }
  }

  if (type === "fill_blank") {
    validateFillBlank(challenge, index);

    if (!challenge.acceptedAnswers.includes(challenge.correctAnswer)) {
      challenge.acceptedAnswers.unshift(challenge.correctAnswer);
    }

    challenge.options = [];
  }

  if (type === "order_steps") {
    if (challenge.steps.length !== 3) {
      throw new Error(`Order steps ${index + 1} must have exactly 3 steps.`);
    }

    if (challenge.correctOrder.length !== challenge.steps.length) {
      throw new Error(`Order steps ${index + 1} correctOrder mismatch.`);
    }

    const stepSet = new Set(challenge.steps);
    const orderSet = new Set(challenge.correctOrder);

    if (stepSet.size !== orderSet.size) {
      throw new Error(`Order steps ${index + 1} duplicate or mismatched steps.`);
    }

    for (const step of stepSet) {
      if (!orderSet.has(step)) {
        throw new Error(`Order steps ${index + 1} correctOrder must contain same steps.`);
      }
    }

    challenge.options = [];
    challenge.steps = shuffleArray(challenge.steps);
  }

  if (type === "spot_mistake") {
    if (!challenge.mistakeText) {
      throw new Error(`Spot mistake ${index + 1} needs mistakeText.`);
    }

    challenge.options = challenge.options.filter(option => !hasBadOptionShape(option));

    if (challenge.options.length !== 4) {
      throw new Error(`Spot mistake ${index + 1} must have 4 clean options.`);
    }

    if (!challenge.options.includes(challenge.correctAnswer)) {
      throw new Error(`Spot mistake ${index + 1} correctAnswer must be one option.`);
    }
  }

  if (type === "matching") {
    if (challenge.pairs.length !== 4) {
      throw new Error(`Matching ${index + 1} must have exactly 4 pairs.`);
    }

    challenge.options = [];
    challenge.correctAnswer = "";
    challenge.correctAnswers = [];
    challenge.shuffledRight = shuffleArray(challenge.pairs.map(p => p.right));
  }

  if (type === "multiple_select") {
    if (!asksForMultipleAnswers(challenge.prompt)) {
      challenge.prompt = `Selectează TOATE variantele corecte: ${challenge.prompt}`.slice(0, 170);
    }

    challenge.options = challenge.options.filter(option => !hasBadOptionShape(option));

    if (challenge.options.length < 4 || challenge.options.length > 5) {
      throw new Error(`Multiple select ${index + 1} must have 4-5 clean options.`);
    }

    if (challenge.correctAnswers.length < 2 || challenge.correctAnswers.length > 3) {
      throw new Error(`Multiple select ${index + 1} needs 2-3 correctAnswers.`);
    }

    for (const answer of challenge.correctAnswers) {
      if (!challenge.options.includes(answer)) {
        throw new Error(`Multiple select ${index + 1}: correctAnswers must be subset of options.`);
      }
    }

    challenge.correctAnswer = "";
  }

  if (!challenge.explanation) {
    challenge.explanation = "Explicația nu a fost generată complet.";
  }

  if (!challenge.sourceSnippet) {
    challenge.sourceSnippet = "Fragment relevant din document.";
  }

  return challenge;
}

export function normalizeLearningPack(rawPack) {
  if (!rawPack || typeof rawPack !== "object") {
    throw new Error("Learning pack is not an object.");
  }

  if (!Array.isArray(rawPack.challenges)) {
    throw new Error("Learning pack missing challenges.");
  }

  if (rawPack.challenges.length !== 8) {
    throw new Error("Learning pack must contain exactly 8 challenges.");
  }

  const challenges = rawPack.challenges.map(normalizeChallenge);

  const typeCounts = challenges.reduce((acc, challenge) => {
    acc[challenge.type] = (acc[challenge.type] || 0) + 1;
    return acc;
  }, {});

  if ((typeCounts.multiple_choice || 0) !== 2) {
    throw new Error("Need exactly 2 multiple_choice challenges.");
  }

  for (const required of [
    "true_false",
    "fill_blank",
    "order_steps",
    "spot_mistake",
    "matching",
    "multiple_select"
  ]) {
    if ((typeCounts[required] || 0) !== 1) {
      throw new Error(`Need exactly 1 ${required} challenge.`);
    }
  }

  return {
    title: normalizeString(rawPack.title) || "ExamForge Arena",
    summary: normalizeString(rawPack.summary) || "AI-generated learning challenges.",
    category: normalizeString(rawPack.category) || "Other",
    concepts: normalizeConcepts(rawPack.concepts),
    challenges
  };
}

export function cleanJson(rawText) {
  const text = String(rawText || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

export function parseAndNormalizePack(rawText) {
  const cleaned = cleanJson(rawText);
  const parsed = JSON.parse(cleaned);

  return normalizeLearningPack(parsed);
}