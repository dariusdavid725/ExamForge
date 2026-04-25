import crypto from "crypto";

export function normalizeString(value) {
  return String(value || "").trim();
}

export function normalizeAnswer(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function removeExternalLinks(text) {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, "[external link removed]")
    .replace(/www\.\S+/gi, "[external link removed]")
    .replace(/\b\S+\.(com|ro|org|net|edu|gov|io|dev|ai)\S*/gi, "[external link removed]");
}

export function cleanExtractedText(text) {
  return String(text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createTextHash(text, salt) {
  return crypto
    .createHash("sha256")
    .update(text.slice(0, 12000) + "|" + salt + "|" + Date.now())
    .digest("hex");
}

export function prepareDocumentSlice(text) {
  const cleanText = cleanExtractedText(text).replace(/\s+/g, " ");

  if (cleanText.length <= 1600) return cleanText;

  const intro = cleanText.slice(0, 700);
  const maxStart = Math.max(0, cleanText.length - 900);
  const randomStart = Math.floor(Math.random() * maxStart);
  const randomPart = cleanText.slice(randomStart, randomStart + 900);

  return intro + "\n\n---\n\n" + randomPart;
}

export function prepareTinyDocumentSlice(text) {
  const cleanText = cleanExtractedText(text).replace(/\s+/g, " ");
  return cleanText.length <= 900 ? cleanText : cleanText.slice(0, 900);
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Fisher-Yates shuffle (unbiased, replaces the biased Math.random() - 0.5 sort)
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
