import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Use the library path directly to avoid pdf-parse loading test files on import
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export async function extractTextFromFile(file) {
  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(file.buffer);
    return data.text;
  }

  if (file.mimetype.startsWith("image/")) {
    // Dynamic import — avoids crashing serverless on startup (tesseract loads WASM lazily)
    const { default: Tesseract } = await import("tesseract.js");
    const result = await Tesseract.recognize(file.buffer, "eng+ron");
    return result.data.text;
  }

  throw new Error("Tip de fișier nesuportat.");
}
