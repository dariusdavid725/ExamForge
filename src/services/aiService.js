import OpenAI from "openai";
import { AI_MODELS } from "../config/constants.js";
import { buildLearningPackPrompt, buildRepairPrompt, buildRecoveryLessonPrompt } from "../utils/promptBuilder.js";
import { parseAndNormalizePack, cleanJson } from "../validators/packValidator.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

async function callOpenAIModel(model, prompt, maxTokens = 2048, temperature = 0.5) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Return strict valid JSON only. No markdown. No explanations." },
      { role: "user", content: prompt }
    ],
    temperature,
    max_tokens: maxTokens
  });

  return completion.choices[0].message.content;
}

async function tryGenerateAndRepair(model, text, gameMode, onProgress) {
  const generationPrompt = buildLearningPackPrompt(text, gameMode);

  onProgress?.("AI is generating challenges...");
  const raw = await callOpenAIModel(model, generationPrompt, 1650, 0.5);

  try {
    const pack = parseAndNormalizePack(raw);
    pack.generatedBy = model;
    pack.aiOnly = true;
    return pack;
  } catch (validationError) {
    console.log(`Initial pack from ${model} invalid, repairing:`, validationError.message);

    onProgress?.("Fixing challenge format...");
    const repairPrompt = buildRepairPrompt(raw, validationError.message, text, gameMode);
    const repairedRaw = await callOpenAIModel(model, repairPrompt, 1900, 0.2);

    const repairedPack = parseAndNormalizePack(repairedRaw);
    repairedPack.generatedBy = model;
    repairedPack.aiOnly = true;
    repairedPack.repairedByAI = true;
    return repairedPack;
  }
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
      const raw = await callOpenAIModel(model, prompt, 950, 0.3);
      const lesson = JSON.parse(cleanJson(raw));
      return { ...lesson, generatedBy: model, aiOnly: true };
    } catch (error) {
      console.log(`Recovery model ${model} failed:`, error.message);
      errors.push(`${model}: ${error.message}`);
    }
  }

  throw new Error("AI recovery lesson failed: " + errors.join(" | "));
}
