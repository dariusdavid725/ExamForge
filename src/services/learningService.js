import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000
});

/**
 * Chunk material into optimal learning units (15-20 min each)
 * Uses AI to identify natural breakpoints and maintain context
 */
export async function chunkMaterial(text, sourceName, sourceType = 'document') {
  try {
    const prompt = `You are an expert educational content analyzer. Your task is to split learning material into optimal "learning units" that respect cognitive load principles.

REQUIREMENTS:
- Each unit should be 15-20 minutes of study time (roughly 800-1200 words)
- Split at natural conceptual boundaries (don't break in middle of concept)
- Each unit should be self-contained but can reference previous units
- Maintain context and coherence
- Include smooth transitions between units

MATERIAL TO CHUNK:
${text.substring(0, 15000)}

Return a JSON array of learning units:
{
  "units": [
    {
      "title": "string (descriptive title for this unit)",
      "content": "string (the actual content for this unit)",
      "concepts": ["concept1", "concept2"],
      "estimatedMinutes": number (15-20),
      "difficultyLevel": number (1-5 scale),
      "prerequisites": ["concept from previous units if any"]
    }
  ]
}

Focus on creating units that build upon each other logically.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.units || [];
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
export async function storeLearningUnits(userId, units, sourceName, sourceType) {
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
      sequence_order: index
    }));

    const { data: insertedUnits, error: unitsError } = await supabase
      .from('learning_units')
      .insert(unitsToInsert)
      .select();

    if (unitsError) throw unitsError;

    // Create user learning paths for each unit
    const pathsToInsert = insertedUnits.map((unit, index) => ({
      user_id: userId,
      learning_unit_id: unit.id,
      status: index === 0 ? 'available' : 'locked', // First unit available, rest locked
      progress_percentage: 0
    }));

    const { error: pathsError } = await supabase
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

    const { data: insertedConcepts, error: conceptsError } = await supabase
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
      const { error: depsError } = await supabase
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
    let query = supabase
      .from('user_learning_paths')
      .select(`
        *,
        learning_unit:learning_units(*)
      `)
      .eq('user_id', userId)
      .order('learning_unit.sequence_order', { ascending: true });

    if (sourceType) {
      query = query.eq('learning_unit.source_type', sourceType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
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

    const { error } = await supabase
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
 */
async function unlockNextUnit(userId, currentUnitId) {
  try {
    // Get current unit's sequence order
    const { data: currentUnit } = await supabase
      .from('learning_units')
      .select('sequence_order, source_type, source_name')
      .eq('id', currentUnitId)
      .single();

    if (!currentUnit) return;

    // Find next unit in sequence
    const { data: nextUnit } = await supabase
      .from('learning_units')
      .select('id')
      .eq('user_id', userId)
      .eq('source_type', currentUnit.source_type)
      .eq('source_name', currentUnit.source_name)
      .gt('sequence_order', currentUnit.sequence_order)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

    if (!nextUnit) return;

    // Unlock it
    await supabase
      .from('user_learning_paths')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('learning_unit_id', nextUnit.id)
      .eq('status', 'locked');

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
    const { data: concept } = await supabase
      .from('concepts')
      .select('*')
      .eq('name', conceptName)
      .single();

    if (!concept) return null;

    // Get user's mastery of this concept
    const { data: mastery } = await supabase
      .from('concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('concept', conceptName)
      .single();

    // Get prerequisites
    const { data: prerequisites } = await supabase
      .from('concept_dependencies')
      .select(`
        strength,
        prerequisite:concepts!concept_dependencies_prerequisite_id_fkey(*)
      `)
      .eq('concept_id', concept.id);

    // Check user's mastery of prerequisites
    const prerequisitesWithMastery = await Promise.all(
      (prerequisites || []).map(async (prereq) => {
        const { data: prereqMastery } = await supabase
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
