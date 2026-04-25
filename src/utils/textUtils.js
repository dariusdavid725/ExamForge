import crypto from "crypto";

const NUMBER_WORDS = {
  zero: "0",

  unu: "1",
  una: "1",
  un: "1",
  o: "1",
  one: "1",

  doi: "2",
  doua: "2",
  două: "2",
  two: "2",

  trei: "3",
  three: "3",

  patru: "4",
  four: "4",

  cinci: "5",
  five: "5",

  sase: "6",
  șase: "6",
  six: "6",

  sapte: "7",
  șapte: "7",
  seven: "7",

  opt: "8",
  eight: "8",

  noua: "9",
  nouă: "9",
  nine: "9",

  zece: "10",
  ten: "10",

  unsprezece: "11",
  eleven: "11",

  doisprezece: "12",
  douasprezece: "12",
  douăsprezece: "12",
  twelve: "12",

  treisprezece: "13",
  thirteen: "13",

  paisprezece: "14",
  fourteen: "14",

  cincisprezece: "15",
  fifteen: "15",

  saisprezece: "16",
  șaisprezece: "16",
  sixteen: "16",

  saptesprezece: "17",
  șaptesprezece: "17",
  seventeen: "17",

  optsprezece: "18",
  eighteen: "18",

  nouasprezece: "19",
  nouăsprezece: "19",
  nineteen: "19",

  douazeci: "20",
  douăzeci: "20",
  twenty: "20",

  treizeci: "30",
  thirty: "30",

  patruzeci: "40",
  forty: "40",

  cincizeci: "50",
  fifty: "50",

  saizeci: "60",
  șaizeci: "60",
  sixty: "60",

  saptezeci: "70",
  șaptezeci: "70",
  seventy: "70",

  optzeci: "80",
  eighty: "80",

  nouazeci: "90",
  nouăzeci: "90",
  ninety: "90",

  suta: "100",
  sută: "100",
  hundred: "100"
};

export function normalizeString(value) {
  return String(value || "").trim();
}

export function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function replaceNumberWords(text) {
  return String(text || "")
    .split(/\s+/)
    .map(word => {
      const cleanWord = stripDiacritics(word)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");

      return NUMBER_WORDS[cleanWord] || word;
    })
    .join(" ");
}

export function normalizeAnswer(value) {
  const numberNormalized = replaceNumberWords(value);

  return String(numberNormalized || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,-]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+lei\b/g, " lei")
    .trim();
}

export function compactAnswer(value) {
  return normalizeAnswer(value).replace(/\s+/g, "");
}

export function answersEquivalent(a, b) {
  const normalizedA = normalizeAnswer(a);
  const normalizedB = normalizeAnswer(b);

  if (!normalizedA || !normalizedB) return false;

  if (normalizedA === normalizedB) return true;

  if (compactAnswer(normalizedA) === compactAnswer(normalizedB)) return true;

  const numberA = normalizedA.replace(",", ".").match(/^-?\d+(\.\d+)?$/);
  const numberB = normalizedB.replace(",", ".").match(/^-?\d+(\.\d+)?$/);

  if (numberA && numberB) {
    return normalizedA.replace(",", ".") === normalizedB.replace(",", ".");
  }

  return false;
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

export function createTextHash(text, salt = "") {
  return crypto
    .createHash("sha256")
    .update(String(text || "").slice(0, 12000) + "|" + salt)
    .digest("hex");
}

export function prepareDocumentSlice(text) {
  const cleanText = cleanExtractedText(text).replace(/\s+/g, " ");

  if (cleanText.length <= 5000) return cleanText;

  const intro = cleanText.slice(0, 2200);
  const middleStart = Math.max(0, Math.floor(cleanText.length / 2) - 900);
  const middle = cleanText.slice(middleStart, middleStart + 1800);
  const end = cleanText.slice(Math.max(0, cleanText.length - 1000));

  return `${intro}\n\n--- MIDDLE SECTION ---\n\n${middle}\n\n--- END SECTION ---\n\n${end}`;
}

export function prepareTinyDocumentSlice(text) {
  const cleanText = cleanExtractedText(text).replace(/\s+/g, " ");

  return cleanText.length <= 1800 ? cleanText : cleanText.slice(0, 1800);
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function shuffleArray(array) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}