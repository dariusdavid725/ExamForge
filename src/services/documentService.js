import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export async function extractTextFromFile(file) {
  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(file.buffer, {
      max: 30  // Limit to first 30 pages for performance
    });
    
    // If PDF is very large, truncate early to avoid excessive processing
    const MAX_CHARS = 50000;
    if (data.text.length > MAX_CHARS) {
      console.log(`PDF truncated from ${data.text.length} to ${MAX_CHARS} chars for performance`);
      return data.text.slice(0, MAX_CHARS);
    }
    
    return data.text;
  }

  if (file.mimetype.startsWith("image/")) {
    // tesseract.js uses worker threads which are not available on Vercel serverless.
    // Dynamic import + try/catch so the app doesn't crash on startup.
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const result = await Tesseract.recognize(file.buffer, "eng+ron");
      return result.data.text;
    } catch {
      throw new Error("Image OCR is not supported in this deployment. Please upload a PDF instead.");
    }
  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}
