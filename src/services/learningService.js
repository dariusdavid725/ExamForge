import { createClient } from "@getSupabase()/getSupabase()-js";
import OpenAI from "openai";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000
});

/**
 * Detect language from text sample
 */
function detectLanguage(text) {
  const sample = text.substring(0, 500).toLowerCase();
  
  // Romanian indicators
  const romanianWords = ['și', 'pentru', 'este', 'sunt', 'despre', 'într', 'dacă', 'această', 'mai', 'cum', 'sau'];
  const romanianCount = romanianWords.filter(word => sample.includes(word)).length;
  
  // English indicators  
  const englishWords = ['the', 'and', 'is', 'are', 'for', 'this', 'that', 'with', 'from', 'have'];
  const englishCount = englishWords.filter(word => sample.includes(` ${word} `)).length;
  
  // French indicators
  const frenchWords = ['le', 'la', 'les', 'de', 'et', 'est', 'pour', 'dans', 'que', 'avec'];
  const frenchCount = frenchWords.filter(word => sample.includes(` ${word} `)).length;
  
  // Spanish indicators
  const spanishWords = ['el', 'la', 'los', 'las', 'de', 'y', 'es', 'para', 'en', 'que'];
  const spanishCount = spanishWords.filter(word => sample.includes(` ${word} `)).length;
  
  // German indicators
  const germanWords = ['der', 'die', 'das', 'und', 'ist', 'für', 'mit', 'von', 'auf', 'zu'];
  const germanCount = germanWords.filter(word => sample.includes(` ${word} `)).length;
  
  const scores = {
    'Romanian': romanianCount,
    'English': englishCount,
    'French': frenchCount,
    'Spanish': spanishCount,
    'German': germanCount
  };
  
  const detected = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return detected[1] > 2 ? detected[0] : 'English'; // Default to English if uncertain
}

/**
 * Chunk material into optimal learning units (15-20 min each)
 * Uses AI to identify natural breakpoints and maintain context
 */
export async function chunkMaterial(text, sourceName, sourceType = 'document') {
  try {
    // Detect language from content
    const detectedLanguage = detectLanguage(text);
    console.log(`Detected language: ${detectedLanguage}`);
    
    // Language-specific instructions
    const languageInstructions = {
      'Romanian': 'IMPORTANT: Generate ALL content in ROMANIAN. All titles, explanations, examples, tips, and questions MUST be in Romanian.',
      'English': 'IMPORTANT: Generate ALL content in ENGLISH. All titles, explanations, examples, tips, and questions MUST be in English.',
      'French': 'IMPORTANT: Generate ALL content in FRENCH. All titles, explanations, examples, tips, and questions MUST be in French.',
      'Spanish': 'IMPORTANT: Generate ALL content in SPANISH. All titles, explanations, examples, tips, and questions MUST be in Spanish.',
      'German': 'IMPORTANT: Generate ALL content in GERMAN. All titles, explanations, examples, tips, and questions MUST be in German.'
    };
    
    const prompt = `You are an expert educational content creator who makes beautiful, interactive study notes. Transform raw material into engaging learning units.

${languageInstructions[detectedLanguage] || languageInstructions['English']}

GOAL: Create study notes like the best student in class - organized, visual, interactive, memorable.

CRITICAL REQUIREMENTS FOR COMPREHENSIVE UNITS:
- Create 5-8 SUBSTANTIAL units (cover the material thoroughly!)
- Each unit MUST be 12-18 minutes of study time
- Each unit MUST contain AT LEAST 400-600 words of rich content
- NEVER create units shorter than 300 words - they must be complete lessons!
- Split at natural concept boundaries - balance between depth and coverage
- Each unit = ONE complete chapter that teaches a concept thoroughly
- More units = better learning progression, but each must still be substantial!

STRUCTURE EACH UNIT WITH:

1. **Clear Sections** with emojis (EACH SECTION MUST BE SUBSTANTIAL):
   - 📝 Overview (3-4 paragraphs explaining context, importance, and what we'll learn)
   - 🎯 Key Concepts (5-7 bullet points with detailed explanations for each)
   - 📚 Detailed Explanation (MAIN CONTENT - 3-5 paragraphs minimum!)
     * Explain WHY, not just WHAT
     * Include multiple concrete examples (at least 2-3)
     * Break down complex ideas step-by-step
     * Use analogies and real-world applications
   - 💡 Pro Tips & Insights (2-3 practical tips with explanations)
   - ⚠️ Common Mistakes to Avoid (2-3 mistakes with explanations why they're wrong)
   - 🔍 Self-Check Questions (3-4 questions with brief answer hints)

2. **Visual Elements**:
   - Use [FORMULA]LaTeX here[/FORMULA] for math
   - CRITICAL FOR FORMULAS: Write LaTeX commands WITHOUT backslashes!
   - Write: frac{dy}{dx}, sqrt{x}, int_0^infty, sum_{i=1}^n, alpha, beta, theta
   - DO NOT write: \\frac, \\sqrt, \\int - backslashes will be added automatically
   - Examples: [FORMULA]frac{dy}{dx} = 3y[/FORMULA], [FORMULA]E = mc^2[/FORMULA], [FORMULA]int_0^infty e^{-x}dx[/FORMULA]
   - Common commands (NO backslashes): frac, sqrt, int, sum, prod, lim, infty, alpha, beta, gamma, theta, pi, sin, cos, tan, log
   - Use [HIGHLIGHT]text[/HIGHLIGHT] for important points
   - Use [EXAMPLE]...content...[/EXAMPLE] for examples
   - Use [TIP]...content...[/TIP] for pro tips
   - Use [WARNING]...content...[/WARNING] for common mistakes

3. **Interactive Elements**:
   - Add "🤔 Think: ..." prompts to encourage reflection
   - Add "✏️ Try: ..." for practice exercises
   - Add analogies and real-world connections

4. **Unit Content Guidelines** (CRITICAL - READ CAREFULLY):
   - Each unit: ONE main topic or concept cluster, explained THOROUGHLY
   - 15-25 minutes study time per unit (500-800 words minimum!)
   - Write like you're teaching a friend: clear, detailed, with lots of examples
   - NEVER just list facts - explain the reasoning and intuition behind concepts
   - Include at least 2-3 worked examples per unit
   - Add practical applications and use cases
   - Self-contained but connected to previous units
   - Use simple language, but BE COMPREHENSIVE - don't skip important details
   - Build progressively (easier concepts first)
   
   **QUALITY CHECK**: If a unit can be read in under 3 minutes, it's TOO SHORT - add more:
   - More examples (at least 2-3 per concept)
   - More detailed explanations (WHY things work, not just WHAT they are)
   - More context (real-world applications, historical background if relevant)
   - More practice questions and exercises

MATERIAL TO SPLIT INTO MULTIPLE UNITS:
${text.substring(0, 25000)}

Return JSON with units (allConcepts is OPTIONAL):
{
  "units": [
    {
      "title": "string (descriptive, engaging title)",
      "content": "string (structured with sections and visual markers)",
      "concepts": ["concept1", "concept2"],
      "estimatedMinutes": number (15-20),
      "difficultyLevel": number (1-5),
      "prerequisites": ["concepts needed before this"]
    }
  ],
  "allConcepts": [
    {
      "name": "string",
      "description": "string",
      "category": "string",
      "difficulty": number (1-5),
      "prerequisites": ["concept names"]
    }
  ]
}

NOTE: allConcepts array is OPTIONAL. If you cannot extract key concepts just return empty array.

CRITICAL FINAL CHECKS BEFORE RETURNING JSON:
- Did I create 3-6 comprehensive units? ✓
- Is EACH unit at least 500-800 words (3-5 paragraphs minimum)? ✓
- Does EACH unit have multiple examples and detailed explanations? ✓
- Did I include all required sections (Overview, Key Concepts, Detailed Explanation, Tips, Mistakes, Questions)? ✓
- Are formulas written WITHOUT backslashes (frac not \\frac)? ✓
- Is ALL content in ${detectedLanguage}? ✓

EXAMPLE OF GOOD UNIT LENGTH (aim for this level of detail):
"📝 **Overview**

In this unit, we'll explore binary search trees (BST), one of the most fundamental data structures in computer science. Unlike simple arrays or linked lists, BSTs provide an elegant way to maintain sorted data while enabling fast search, insertion, and deletion operations. Understanding BSTs is crucial because they form the foundation for more advanced structures like AVL trees, Red-Black trees, and database indexes.

The key insight behind BSTs is using the binary tree property combined with an ordering rule: for every node, all values in the left subtree are smaller, and all values in the right subtree are larger. This simple rule enables remarkably efficient algorithms.

🎯 **Key Concepts**

- **Binary Search Tree Property**: For any node N, all values in N's left subtree are less than N's value, and all values in N's right subtree are greater than N's value. This recursive property must hold for every node in the tree.

- **Search Operation**: Finding a value takes O(log n) time in a balanced tree because we can eliminate half the remaining nodes at each step, similar to binary search in a sorted array.

[... continues with 3-4 more paragraphs of detailed content, examples, tips, etc. ...]"

Remember: Quality > Quantity. Better to have 4 amazing units than 10 shallow ones!
- TRY to return allConcepts array with key concepts (OPTIONAL - return empty array if unsure)`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    let result;
    try {
      result = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.log("Raw AI response:", response.choices[0].message.content);
      // Try to salvage partial response
      const content = response.choices[0].message.content;
      const unitsMatch = content.match(/"units"\s*:\s*\[(.*?)\]/s);
      if (unitsMatch) {
        result = { units: JSON.parse(`[${unitsMatch[1]}]`), allConcepts: [] };
      } else {
        throw new Error("Failed to parse AI response");
      }
    }
    
    // CRITICAL VALIDATION: Reject units that are too short
    const MIN_WORDS_PER_UNIT = 300; // Minimum acceptable
    const RECOMMENDED_WORDS = 500; // What we want
    
    const units = result.units || [];
    const validatedUnits = [];
    
    for (const unit of units) {
      const wordCount = unit.content.split(/\s+/).length;
      
      if (wordCount < MIN_WORDS_PER_UNIT) {
        console.warn(`⚠️ Unit "${unit.title}" is TOO SHORT (${wordCount} words). Minimum is ${MIN_WORDS_PER_UNIT}. SKIPPING.`);
        continue; // Skip this unit
      }
      
      if (wordCount < RECOMMENDED_WORDS) {
        console.warn(`⚠️ Unit "${unit.title}" is below recommended length (${wordCount}/${RECOMMENDED_WORDS} words)`);
      } else {
        console.log(`✓ Unit "${unit.title}" has good length (${wordCount} words)`);
      }
      
      validatedUnits.push(unit);
    }
    
    if (validatedUnits.length === 0) {
      throw new Error(`AI generated units that are too short. All units were rejected. Please try with more substantial material.`);
    }
    
    console.log(`Validated ${validatedUnits.length}/${units.length} units (${units.length - validatedUnits.length} rejected for being too short)`);
    
    // Return both units and concepts for faster processing
    return {
      units: validatedUnits,
      concepts: result.allConcepts || result.concepts || []
    };
  } catch (error) {
    console.error("Error chunking material:", error);
    // Fallback: simple character-based chunking
    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push({
        title: `Unit ${Math.floor(i / chunkSize) + 1}`,
        content: text.substring(i, i + chunkSize),
        concepts: [],
        estimatedMinutes: 15,
        difficultyLevel: 3,
        prerequisites: []
      });
    }
    return chunks;
  }
}

/**
 * Extract concepts and their relationships from material
 * Builds a knowledge graph
 */
export async function extractConceptsAndDependencies(units) {
  try {
    const allContent = units.map((u, i) => `Unit ${i + 1}: ${u.title}\n${u.content}`).join('\n\n');

    const prompt = `You are an expert at analyzing educational content and identifying key concepts and their relationships.

TASK: Analyze the learning material and extract:
1. All key concepts (important ideas, terms, principles)
2. Relationships between concepts (which concepts depend on others)

MATERIAL:
${allContent.substring(0, 12000)}

Return JSON:
{
  "concepts": [
    {
      "name": "string (concept name)",
      "description": "string (brief explanation)",
      "category": "string (topic area)",
      "difficultyLevel": number (1-5)
    }
  ],
  "dependencies": [
    {
      "concept": "concept name",
      "prerequisite": "prerequisite concept name",
      "strength": number (1=weak, 2=medium, 3=strong dependency)
    }
  ]
}

Focus on concepts that are truly foundational vs advanced.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      concepts: result.concepts || [],
      dependencies: result.dependencies || []
    };
  } catch (error) {
    console.error("Error extracting concepts:", error);
    return { concepts: [], dependencies: [] };
  }
}

/**
 * Store learning units and concepts in database
 */
export async function storeLearningUnits(userId, units, sourceName, sourceType, autoTitle = null, categoryId = null) {
  try {
    // Store units
    const unitsToInsert = units.map((unit, index) => ({
      user_id: userId,
      title: unit.title,
      source_type: sourceType,
      source_name: sourceName,
      content: unit.content,
      concepts: JSON.stringify(unit.concepts || []),
      difficulty_level: unit.difficultyLevel || 3,
      estimated_time_minutes: unit.estimatedMinutes || 15,
      sequence_order: index,
      auto_title: autoTitle || sourceName,
      category_id: categoryId
    }));

    const { data: insertedUnits, error: unitsError } = await getSupabase()
      .from('learning_units')
      .insert(unitsToInsert)
      .select();

    if (unitsError) throw unitsError;

    // Create user learning paths for each unit
    // CRITICAL: Sort by sequence_order to ensure correct lock progression
    const sortedUnits = [...insertedUnits].sort((a, b) => a.sequence_order - b.sequence_order);
    const pathsToInsert = sortedUnits.map((unit, index) => ({
      user_id: userId,
      learning_unit_id: unit.id,
      status: index === 0 ? 'available' : 'locked', // First unit available, rest locked
      progress_percentage: 0
    }));

    const { error: pathsError } = await getSupabase()
      .from('user_learning_paths')
      .insert(pathsToInsert);

    if (pathsError) throw pathsError;

    return insertedUnits;
  } catch (error) {
    console.error("Error storing learning units:", error);
    throw error;
  }
}

/**
 * Store concepts and dependencies in database
 */
export async function storeConceptsAndDependencies(conceptsData) {
  try {
    const { concepts, dependencies } = conceptsData;

    // Upsert concepts
    const conceptsToUpsert = concepts.map(c => ({
      name: c.name,
      description: c.description || null,
      category: c.category || null,
      difficulty_level: c.difficultyLevel || 3
    }));

    const { data: insertedConcepts, error: conceptsError } = await getSupabase()
      .from('concepts')
      .upsert(conceptsToUpsert, { onConflict: 'name', ignoreDuplicates: false })
      .select();

    if (conceptsError) throw conceptsError;

    // Create concept ID map
    const conceptMap = {};
    insertedConcepts.forEach(c => {
      conceptMap[c.name] = c.id;
    });

    // Insert dependencies
    const dependenciesToInsert = dependencies
      .filter(d => conceptMap[d.concept] && conceptMap[d.prerequisite])
      .map(d => ({
        concept_id: conceptMap[d.concept],
        prerequisite_id: conceptMap[d.prerequisite],
        strength: d.strength || 2
      }));

    if (dependenciesToInsert.length > 0) {
      const { error: depsError } = await getSupabase()
        .from('concept_dependencies')
        .upsert(dependenciesToInsert, {
          onConflict: 'concept_id,prerequisite_id',
          ignoreDuplicates: true
        });

      if (depsError) throw depsError;
    }

    return insertedConcepts;
  } catch (error) {
    console.error("Error storing concepts:", error);
    throw error;
  }
}

/**
 * Get user's learning path with progress
 */
export async function getUserLearningPath(userId, sourceType = null) {
  try {
    let query = getSupabase()
      .from('user_learning_paths')
      .select(`
        *,
        learning_unit:learning_units(*)
      `)
      .eq('user_id', userId);

    if (sourceType) {
      // Note: filtering on nested fields doesn't work well in Supabase
      // We'll filter after fetching
    }

    const { data, error } = await query;

    if (error) throw error;

    let pathData = data || [];

    // Filter by source type if specified
    if (sourceType && pathData.length > 0) {
      pathData = pathData.filter(p => p.learning_unit?.source_type === sourceType);
    }

    // Sort by sequence_order
    pathData.sort((a, b) => {
      const orderA = a.learning_unit?.sequence_order || 0;
      const orderB = b.learning_unit?.sequence_order || 0;
      return orderA - orderB;
    });

    console.log(`Found ${pathData.length} learning units for user ${userId}`);
    return pathData;
  } catch (error) {
    console.error("Error getting learning path:", error);
    return [];
  }
}

/**
 * Update learning path progress
 */
export async function updateLearningProgress(userId, unitId, progressPercentage, completed = false) {
  try {
    const updates = {
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString()
    };

    if (completed) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    } else if (progressPercentage > 0) {
      updates.status = 'in_progress';
      if (!updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
    }

    const { error } = await getSupabase()
      .from('user_learning_paths')
      .update(updates)
      .eq('user_id', userId)
      .eq('learning_unit_id', unitId);

    if (error) throw error;

    // If completed, unlock next unit
    if (completed) {
      await unlockNextUnit(userId, unitId);
    }

    return true;
  } catch (error) {
    console.error("Error updating learning progress:", error);
    return false;
  }
}

/**
 * Unlock next learning unit when current is completed
 * CRITICAL: Only unlock IMMEDIATE next unit (sequence_order + 1)
 */
async function unlockNextUnit(userId, currentUnitId) {
  try {
    // Get current unit's sequence order
    const { data: currentUnit } = await getSupabase()
      .from('learning_units')
      .select('sequence_order, source_type, source_name')
      .eq('id', currentUnitId)
      .single();

    if (!currentUnit) {
      console.error('Current unit not found:', currentUnitId);
      return;
    }

    console.log(`Unlocking next after unit ${currentUnitId}, sequence: ${currentUnit.sequence_order}`);

    // Find THE EXACT next unit (sequence_order + 1, not just greater)
    const { data: nextUnit } = await getSupabase()
      .from('learning_units')
      .select('id, sequence_order')
      .eq('user_id', userId)
      .eq('source_type', currentUnit.source_type)
      .eq('source_name', currentUnit.source_name)
      .eq('sequence_order', currentUnit.sequence_order + 1)
      .single();

    if (!nextUnit) {
      console.log('No next unit found (might be last unit)');
      return;
    }

    console.log(`Found next unit ${nextUnit.id}, unlocking...`);

    // Check current status
    const { data: pathStatus } = await getSupabase()
      .from('user_learning_paths')
      .select('status')
      .eq('user_id', userId)
      .eq('learning_unit_id', nextUnit.id)
      .single();

    if (pathStatus && pathStatus.status === 'locked') {
      // Only unlock if currently locked
      const { error: unlockError } = await getSupabase()
        .from('user_learning_paths')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('learning_unit_id', nextUnit.id);

      if (unlockError) {
        console.error('Error updating status:', unlockError);
      } else {
        console.log(`✓ Unlocked unit ${nextUnit.id} (sequence ${nextUnit.sequence_order})`);
      }
    } else {
      console.log(`Unit ${nextUnit.id} already unlocked (status: ${pathStatus?.status})`);
    }

  } catch (error) {
    console.error("Error unlocking next unit:", error);
  }
}

/**
 * Get concept mastery with prerequisites check
 */
export async function getConceptMasteryWithPrerequisites(userId, conceptName) {
  try {
    // Get the concept
    const { data: concept } = await getSupabase()
      .from('concepts')
      .select('*')
      .eq('name', conceptName)
      .single();

    if (!concept) return null;

    // Get user's mastery of this concept
    const { data: mastery } = await getSupabase()
      .from('concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('concept', conceptName)
      .single();

    // Get prerequisites
    const { data: prerequisites } = await getSupabase()
      .from('concept_dependencies')
      .select(`
        strength,
        prerequisite:concepts!concept_dependencies_prerequisite_id_fkey(*)
      `)
      .eq('concept_id', concept.id);

    // Check user's mastery of prerequisites
    const prerequisitesWithMastery = await Promise.all(
      (prerequisites || []).map(async (prereq) => {
        const { data: prereqMastery } = await getSupabase()
          .from('concept_mastery')
          .select('mastery_level')
          .eq('user_id', userId)
          .eq('concept', prereq.prerequisite.name)
          .single();

        return {
          ...prereq.prerequisite,
          strength: prereq.strength,
          userMasteryLevel: prereqMastery?.mastery_level || 0,
          isMastered: (prereqMastery?.mastery_level || 0) >= 3
        };
      })
    );

    return {
      concept,
      mastery: mastery || { mastery_level: 0 },
      prerequisites: prerequisitesWithMastery,
      isReadyToLearn: prerequisitesWithMastery.every(p => p.strength < 3 || p.isMastered)
    };
  } catch (error) {
    console.error("Error getting concept mastery:", error);
    return null;
  }
}
