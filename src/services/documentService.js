import Tesseract from "tesseract.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export async function extractTextFromFile(file) {
  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(file.buffer);
    return data.text;
  }

  if (file.mimetype.startsWith("image/")) {
    const result = await Tesseract.recognize(file.buffer, "eng+ron");
    return result.data.text;
  }

  throw new Error("Tip de fișier nesuportat.");
}
