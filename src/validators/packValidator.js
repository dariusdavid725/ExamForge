import { normalizeString, shuffleArray } from "../utils/textUtils.js";

function normalizeConcepts(concepts) {
  if (!Array.isArray(concepts)) return ["Concepte principale"];

  const normalized = concepts
    .map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item.name === "string") return item.name;
      return "";
    })
    .map(item => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized.slice(0, 8) : ["Concepte principale"];
}

function normalizeChallenge(raw, index) {
  const type = normalizeString(raw.type);

  const allowedTypes = [
    "multiple_choice",
    "true_false",
    "fill_blank",
    "order_steps",
    "spot_mistake"
  ];

  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid challenge type at ${index + 1}: ${type}`);
  }

  const challenge = {
    id: `c${index + 1}`,
    type,
    concept: normalizeString(raw.concept) || "Concept",
    difficulty: normalizeString(raw.difficulty) || "medium",
    prompt: normalizeString(raw.prompt),
    options: Array.isArray(raw.options) ? raw.options.map(normalizeString).filter(Boolean) : [],
    correctAnswer: normalizeString(raw.correctAnswer),
    acceptedAnswers: Array.isArray(raw.acceptedAnswers)
      ? raw.acceptedAnswers.map(normalizeString).filter(Boolean)
      : [],
    steps: Array.isArray(raw.steps) ? raw.steps.map(normalizeString).filter(Boolean) : [],
    correctOrder: Array.isArray(raw.correctOrder)
      ? raw.correctOrder.map(normalizeString).filter(Boolean)
      : [],
    mistakeText: normalizeString(raw.mistakeText),
    explanation: normalizeString(raw.explanation),
    sourceSnippet: normalizeString(raw.sourceSnippet)
  };

  if (!challenge.prompt && type !== "spot_mistake") {
    throw new Error(`Challenge ${index + 1} has no prompt.`);
  }

  if (type === "multiple_choice") {
    if (challenge.options.length !== 4) {
      throw new Error(`Multiple choice ${index + 1} must have 4 options.`);
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
    if (!challenge.prompt.includes("____")) {
      throw new Error(`Fill blank ${index + 1} must contain ____.`);
    }
    if (!challenge.correctAnswer) {
      throw new Error(`Fill blank ${index + 1} needs correctAnswer.`);
    }
    if (!challenge.acceptedAnswers.includes(challenge.correctAnswer)) {
      challenge.acceptedAnswers.unshift(challenge.correctAnswer);
    }
    challenge.options = [];
  }

  if (type === "order_steps") {
    if (challenge.steps.length < 3 || challenge.steps.length > 5) {
      throw new Error(`Order steps ${index + 1} must have 3-5 steps.`);
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
    if (challenge.options.length !== 4) {
      throw new Error(`Spot mistake ${index + 1} must have 4 options.`);
    }
    if (!challenge.options.includes(challenge.correctAnswer)) {
      throw new Error(`Spot mistake ${index + 1} correctAnswer must be one option.`);
    }
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

  const typeCounts = challenges.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  if ((typeCounts.multiple_choice || 0) < 2) {
    throw new Error("Need at least 2 multiple_choice challenges.");
  }

  for (const required of ["true_false", "fill_blank", "order_steps", "spot_mistake"]) {
    if (!typeCounts[required]) {
      throw new Error(`Missing challenge type: ${required}`);
    }
  }

  return {
    title: normalizeString(rawPack.title) || "ExamForge Arena",
    summary: normalizeString(rawPack.summary) || "AI-generated learning challenges from your document.",
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
