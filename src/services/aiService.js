import OpenAI from "openai";
import { AI_MODELS } from "../config/constants.js";
import {
  buildLearningPackPrompt,
  buildRepairPrompt,
  buildRecoveryLessonPrompt,
  buildAuditPrompt
} from "../utils/promptBuilder.js";
import {
  parseAndNormalizePack,
  cleanJson
} from "../validators/packValidator.js";

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
  required: ["title", "summary", "sections"],
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
          "whatWentWrong",
          "miniLesson",
          "memoryHook",
          "retryChallenge"
        ],
        properties: {
          concept: { type: "string" },
          whatWentWrong: { type: "string" },
          miniLesson: { type: "string" },
          memoryHook: { type: "string" },
          retryChallenge: { type: "string" }
        }
      }
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

async function callJsonSchema(model, prompt, schema, name, maxTokens = 3500, temperature = 0.2) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "Return strict valid JSON only. No markdown. No explanations."
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

async function tryGenerateAndRepair(model, text, gameMode, onProgress) {
  onProgress?.("AI is generating strict challenges...");

  const raw = await callJsonSchema(
    model,
    buildLearningPackPrompt(text, gameMode),
    LEARNING_PACK_SCHEMA,
    "learning_pack",
    3600,
    0.25
  );

  let pack = parseAndNormalizePack(raw);

  onProgress?.("Checking challenge quality...");

  const audit = await auditPack(model, text, pack);

  if (audit.valid) {
    pack.generatedBy = model;
    pack.aiOnly = true;
    return pack;
  }

  onProgress?.("Repairing low-quality questions...");

  const repairPrompt = buildRepairPrompt(
    JSON.stringify(pack),
    audit.problems.join(" | "),
    text,
    gameMode
  );

  const repairedRaw = await callJsonSchema(
    model,
    repairPrompt,
    LEARNING_PACK_SCHEMA,
    "learning_pack_repair",
    3600,
    0.15
  );

  const repairedPack = parseAndNormalizePack(repairedRaw);

  const secondAudit = await auditPack(model, text, repairedPack);

  if (!secondAudit.valid) {
    throw new Error("AI quality audit failed: " + secondAudit.problems.join(" | "));
  }

  repairedPack.generatedBy = model;
  repairedPack.aiOnly = true;
  repairedPack.repairedByAI = true;

  return repairedPack;
}

export async function generateLearningPackWithAI(text, gameMode, onProgress) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY lipsește din .env.");
  }

  const errors = [];

  for (const model of AI_MODELS) {
    try {
      console.log(`Trying learning pack model: ${model}`);

      return await tryGenerateAndRepair(model, text, gameMode, onProgress);
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

  if (errors.every(e => e.rateLimit)) {
    throw new Error("Rate limit reached. Așteaptă și încearcă din nou.");
  }

  if (errors.every(e => e.tooLarge)) {
    throw new Error("Documentul este prea mare. Încearcă un PDF mai scurt.");
  }

  throw new Error(
    "AI generation failed: " +
      errors.map(e => `${e.model}: ${e.message}`).join(" | ")
  );
}

export async function generateRecoveryLessonWithAI(room, player) {
  const missedAnswers = player.answers.filter(a => !a.isCorrect);

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
        ...JSON.parse(raw),
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