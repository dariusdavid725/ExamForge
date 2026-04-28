import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a smart, descriptive title for a lesson
 * Like ChatGPT auto-naming: brief but informative
 * 
 * @param {Object} lesson - The lesson object with sections/content
 * @param {string} documentText - Original document text (optional)
 * @returns {Promise<string>} - Generated title (max 60 chars)
 */
export async function generateLessonTitle(lesson, documentText = "") {
  try {
    // Extract key info from lesson
    const sections = lesson.sections?.slice(0, 3) || [];
    const sectionTitles = sections.map(s => s.title || s.heading).filter(Boolean).join(", ");
    const firstContent = sections[0]?.content?.slice(0, 300) || "";
    const docSnippet = documentText.slice(0, 500);

    const prompt = `Generate a brief, descriptive title for this educational lesson. 
Title should be 3-6 words, clear and specific.
Do NOT use generic words like "Lesson", "Study", "Notes", "Guide".
Focus on the actual TOPIC and SUBTOPIC.

Examples of GOOD titles:
- "Differential Equations Basics"
- "French Revolution Timeline"
- "Organic Chemistry Reactions"
- "Python Data Structures"

Examples of BAD titles:
- "Math Lesson" (too generic)
- "Study Guide for Chapter 3" (not descriptive)
- "Notes" (useless)

Lesson sections: ${sectionTitles}
${firstContent ? `Content preview: ${firstContent}` : ''}
${docSnippet ? `Document: ${docSnippet}` : ''}

Return ONLY the title, nothing else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 20
    });

    let title = response.choices[0]?.message?.content?.trim() || "";
    
    // Clean up
    title = title.replace(/^["']|["']$/g, ''); // Remove quotes
    title = title.replace(/^Title:\s*/i, ''); // Remove "Title:" prefix
    
    // Truncate if too long
    if (title.length > 60) {
      title = title.slice(0, 57) + "...";
    }

    return title || "Untitled Lesson";

  } catch (error) {
    console.error("Error generating lesson title:", error);
    
    // Fallback: use first section title
    const firstSection = lesson.sections?.[0];
    if (firstSection?.title || firstSection?.heading) {
      return (firstSection.title || firstSection.heading).slice(0, 60);
    }
    
    return "Untitled Lesson";
  }
}

/**
 * Suggest a category based on lesson content
 * 
 * @param {Object} lesson - The lesson object
 * @param {Array} existingCategories - User's existing categories
 * @returns {Promise<string|null>} - Suggested category name or null
 */
export async function suggestCategory(lesson, existingCategories = []) {
  try {
    const sections = lesson.sections?.slice(0, 3) || [];
    const content = sections.map(s => `${s.title}: ${s.content?.slice(0, 200)}`).join("\n");
    
    const categoryNames = existingCategories.map(c => c.name).join(", ");

    const prompt = `Based on this lesson content, which category does it belong to?

Available categories: ${categoryNames}

Lesson content:
${content}

Return ONLY the category name from the list above, or "Other" if none fit.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 10
    });

    const suggested = response.choices[0]?.message?.content?.trim() || "Other";
    
    // Find matching category
    const match = existingCategories.find(
      c => c.name.toLowerCase() === suggested.toLowerCase()
    );

    return match?.id || null;

  } catch (error) {
    console.error("Error suggesting category:", error);
    return null;
  }
}
