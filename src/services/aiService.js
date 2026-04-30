import OpenAI from "openai";
import { AI_MODELS } from "../config/constants.js";
import {
  buildLearningPackPrompt,
  buildTopicPackPrompt,
  buildRepairPrompt,
  buildRecoveryLessonPrompt,
  buildAuditPrompt
} from "../utils/promptBuilder.js";
import {
  parseAndNormalizePack,
  cleanJson
} from "../validators/packValidator.js";
import { shuffleArray } from "../utils/textUtils.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000
});

const LEARNING_PACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "category", "concepts", "challenges"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    category: { type: "string" },
    concepts: {
      type: "array",
      items: { type: "string" }
    },
    challenges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "type",
          "concept",
          "difficulty",
          "prompt",
          "options",
          "correctAnswer",
          "correctAnswers",
          "pairs",
          "acceptedAnswers",
          "steps",
          "correctOrder",
          "mistakeText",
          "explanation",
          "sourceSnippet"
        ],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "multiple_choice",
              "true_false",
              "fill_blank",
              "order_steps",
              "spot_mistake",
              "matching",
              "multiple_select"
            ]
          },
          concept: { type: "string" },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"]
          },
          prompt: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" }
          },
          correctAnswer: { type: "string" },
          correctAnswers: {
            type: "array",
            items: { type: "string" }
          },
          pairs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["left", "right"],
              properties: {
                left: { type: "string" },
                right: { type: "string" }
              }
            }
          },
          acceptedAnswers: {
            type: "array",
            items: { type: "string" }
          },
          steps: {
            type: "array",
            items: { type: "string" }
          },
          correctOrder: {
            type: "array",
            items: { type: "string" }
          },
          mistakeText: { type: "string" },
          explanation: { type: "string" },
          sourceSnippet: { type: "string" }
        }
      }
    }
  }
};

const AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["valid", "problems"],
  properties: {
    valid: { type: "boolean" },
    problems: {
      type: "array",
      items: { type: "string" }
    }
  }
};

const RECOVERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "sections", "nextSteps"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "concept",
          "misconceptionIdentified",
          "whyItMatters",
          "correctUnderstanding",
          "concreteExample",
          "memoryHook",
          "selfTestPrompt"
        ],
        properties: {
          concept: { type: "string" },
          misconceptionIdentified: { type: "string" },
          whyItMatters: { type: "string" },
          correctUnderstanding: { type: "string" },
          concreteExample: { type: "string" },
          memoryHook: { type: "string" },
          selfTestPrompt: { type: "string" }
        }
      }
    },
    nextSteps: {
      type: "array",
      items: { type: "string" }
    }
  }
};

function isRateLimitError(error) {
  return (
    error?.status === 429 ||
    String(error?.message || "").toLowerCase().includes("rate limit")
  );
}

function isRequestTooLargeError(error) {
  return (
    error?.status === 413 ||
    String(error?.message || "").toLowerCase().includes("too large") ||
    String(error?.message || "").toLowerCase().includes("too many tokens")
  );
}

async function callJsonSchema(
  model,
  prompt,
  schema,
  name,
  maxTokens = 3600,
  temperature = 0.2
) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          "Return strict valid JSON only.",
          "No markdown.",
          "No explanations.",
          "Every challenge must be self-contained.",
          "If a question refers to a hidden line/page/snippet, rewrite it by including the visible snippet in the prompt.",
          "If the snippet cannot be included clearly, replace that challenge with another one from the document."
        ].join("\n")
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name,
        strict: true,
        schema
      }
    },
    temperature,
    max_tokens: maxTokens
  });

  return completion.choices[0].message.content;
}

async function auditPack(model, text, pack) {
  const raw = await callJsonSchema(
    model,
    buildAuditPrompt(text, pack),
    AUDIT_SCHEMA,
    "pack_audit",
    900,
    0
  );

  return JSON.parse(raw);
}

async function repairUntilValid({
  model,
  rawPackText,
  reason,
  text,
  gameMode,
  onProgress
}) {
  let currentRaw = rawPackText;
  let currentReason = reason;

  for (let repairAttempt = 1; repairAttempt <= 3; repairAttempt++) {
    onProgress?.(`AI repairing unclear questions... attempt ${repairAttempt}`);

    const repairPrompt = buildRepairPrompt(
      currentRaw,
      currentReason,
      text,
      gameMode,
      repairAttempt
    );

    let repairedRaw = "";

    try {
      const repairHb = setInterval(() => {
        onProgress?.(`Repairing pack… attempt ${repairAttempt} (still working)…`);
      }, 8000);
      try {
        repairedRaw = await callJsonSchema(
          model,
          repairPrompt,
          LEARNING_PACK_SCHEMA,
          "learning_pack_repair",
          3800,
          0.12
        );
      } finally {
        clearInterval(repairHb);
      }
    } catch (error) {
      currentReason = error.message;
      continue;
    }

    let repairedPack;

    try {
      repairedPack = parseAndNormalizePack(repairedRaw);
    } catch (error) {
      currentRaw = repairedRaw;
      currentReason = error.message;
      continue;
    }

    const audit = await auditPack(model, text, repairedPack);

    if (audit.valid) {
      repairedPack.generatedBy = model;
      repairedPack.aiOnly = true;
      repairedPack.repairedByAI = true;
      repairedPack.repairAttempt = repairAttempt;
      repairedPack.challenges = shuffleArray(repairedPack.challenges || []);

      return repairedPack;
    }

    currentRaw = JSON.stringify(repairedPack, null, 2);
    currentReason = audit.problems.join(" | ");
  }

  throw new Error(currentReason || "AI repair failed.");
}

async function tryGenerateAndRepair(model, text, gameMode, onProgress, isTopic = false) {
  onProgress?.("AI is generating challenges...");

  const prompt = isTopic
    ? buildTopicPackPrompt(text, gameMode)
    : buildLearningPackPrompt(text, gameMode);

  // Long OpenAI call — no SSE until it returns; keep the UI moving so it does not look stuck at ~8%.
  const heartbeat = setInterval(() => {
    onProgress?.("Still creating challenges (40–120s is normal)…");
  }, 8000);

  let raw;
  try {
    raw = await callJsonSchema(
      model,
      prompt,
      LEARNING_PACK_SCHEMA,
      "learning_pack",
      3800,
      0.25
    );
  } finally {
    clearInterval(heartbeat);
  }

  let pack;

  try {
    pack = parseAndNormalizePack(raw);
  } catch (error) {
    console.log("Initial pack failed validation, repairing:", error.message);

    return await repairUntilValid({
      model,
      rawPackText: raw,
      reason: error.message,
      text,
      gameMode,
      onProgress
    });
  }

  // Skip document-grounded audit for topic-based generation
  if (isTopic) {
    pack.generatedBy = model;
    pack.aiOnly      = true;
    pack.challenges  = shuffleArray(pack.challenges || []);
    return pack;
  }

  onProgress?.("Checking question quality...");

  const audit = await auditPack(model, text, pack);

  if (audit.valid) {
    pack.generatedBy = model;
    pack.aiOnly = true;
    pack.challenges = shuffleArray(pack.challenges || []);

    return pack;
  }

  console.log("Initial pack failed audit, repairing:", audit.problems);

  return await repairUntilValid({
    model,
    rawPackText: JSON.stringify(pack, null, 2),
    reason: audit.problems.join(" | "),
    text,
    gameMode,
    onProgress
  });
}

export async function generateLearningPackWithAI(text, gameMode, onProgress, isTopic = false) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from .env.");
  }

  const errors = [];

  for (const model of AI_MODELS) {
    try {
      console.log(`Trying learning pack model: ${model}`);

      return await tryGenerateAndRepair(model, text, gameMode, onProgress, isTopic);
    } catch (error) {
      console.log(`Model ${model} failed:`, error.message);

      errors.push({
        model,
        message: error.message,
        rateLimit: isRateLimitError(error),
        tooLarge: isRequestTooLargeError(error)
      });
    }
  }

  if (errors.every(error => error.rateLimit)) {
    throw new Error("Rate limit reached. Please wait and try again.");
  }

  if (errors.every(error => error.tooLarge)) {
    throw new Error("Document is too large. Try a shorter PDF.");
  }

  throw new Error(
    "AI generation failed: " +
      errors.map(error => `${error.model}: ${error.message}`).join(" | ")
  );
}

export async function generateRecoveryLessonWithAI(room, player) {
  const missedAnswers = player.answers.filter(answer => !answer.isCorrect);

  if (missedAnswers.length === 0) {
    return {
      title: "No recovery needed",
      summary: "You did not miss any challenges in this arena.",
      sections: []
    };
  }

  const prompt = buildRecoveryLessonPrompt(room, player);
  const errors = [];

  for (const model of AI_MODELS) {
    try {
      console.log(`Trying recovery lesson model: ${model}`);

      const raw = await callJsonSchema(
        model,
        prompt,
        RECOVERY_SCHEMA,
        "recovery_lesson",
        1400,
        0.25
      );

      return {
        ...JSON.parse(cleanJson(raw)),
        generatedBy: model,
        aiOnly: true
      };
    } catch (error) {
      console.log(`Recovery model ${model} failed:`, error.message);
      errors.push(`${model}: ${error.message}`);
    }
  }

  throw new Error("AI recovery lesson failed: " + errors.join(" | "));
}