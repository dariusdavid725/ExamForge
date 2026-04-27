import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  chunkMaterial,
  extractConceptsAndDependencies,
  storeLearningUnits,
  storeConceptsAndDependencies,
  getUserLearningPath,
  updateLearningProgress,
  getConceptMasteryWithPrerequisites
} from "../services/learningService.js";
import { extractTextFromFile } from "../services/documentService.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const router = express.Router();

/**
 * POST /api/learning/process-material
 * Process uploaded document into learning units
 */
router.post("/process-material", async (req, res) => {
  try {
    const { userId, documentName, documentText, sourceType = 'document' } = req.body;

    if (!userId || !documentText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Step 1: Chunk material AND extract concepts in ONE AI call (faster!)
    console.log("Processing material with AI...");
    const result = await chunkMaterial(documentText, documentName, sourceType);
    
    const units = result.units || [];
    const concepts = result.concepts || [];

    if (units.length === 0) {
      return res.status(400).json({ error: "Failed to process material" });
    }

    // Step 2: Store units in database
    console.log("Storing learning units...");
    const storedUnits = await storeLearningUnits(userId, units, documentName, sourceType);

    // Step 3: Store concepts (if any were extracted)
    if (concepts.length > 0) {
      console.log("Storing concepts...");
      const conceptsData = {
        concepts: concepts.map(c => ({
          name: c.name,
          description: c.description,
          category: c.category,
          difficulty: c.difficulty
        })),
        dependencies: concepts.flatMap(c => 
          (c.prerequisites || []).map(prereq => ({
            concept: c.name,
            prerequisite: prereq
          }))
        )
      };
      await storeConceptsAndDependencies(conceptsData);
    }

    res.json({
      success: true,
      units: storedUnits,
      conceptsCount: concepts.length,
      message: `Created ${storedUnits.length} learning units with ${concepts.length} concepts`
    });

  } catch (error) {
    console.error("Error processing material:", error);
    res.status(500).json({ error: "Failed to process material" });
  }
});

/**
 * POST /api/learning/process-upload
 * Process file upload (PDF/image) into learning path
 */
router.post("/process-upload", async (req, res) => {
  try {
    const { userId, file } = req.body;

    if (!userId || !file || !file.buffer) {
      return res.status(400).json({ error: "Missing file or userId" });
    }

    // Extract text from file
    const text = await extractTextFromFile(file);

    if (!text || text.length < 100) {
      return res.status(400).json({ error: "Could not extract enough text from file" });
    }

    // Process the extracted text
    const units = await chunkMaterial(text, file.originalname || 'Document', 'document');
    const conceptsData = await extractConceptsAndDependencies(units);
    const storedUnits = await storeLearningUnits(userId, units, file.originalname, 'document');
    await storeConceptsAndDependencies(conceptsData);

    res.json({
      success: true,
      units: storedUnits,
      conceptsCount: conceptsData.concepts.length
    });

  } catch (error) {
    console.error("Error processing upload:", error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

/**
 * GET /api/learning/path/:userId
 * Get user's learning path with progress
 */
router.get("/path/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { sourceType } = req.query;

    const path = await getUserLearningPath(userId, sourceType);

    res.json({
      success: true,
      path,
      totalUnits: path.length,
      completedUnits: path.filter(p => p.status === 'completed').length,
      currentUnit: path.find(p => p.status === 'in_progress') || path.find(p => p.status === 'available')
    });

  } catch (error) {
    console.error("Error getting learning path:", error);
    res.status(500).json({ error: "Failed to get learning path" });
  }
});

/**
 * POST /api/learning/progress
 * Update progress on a learning unit
 */
router.post("/progress", async (req, res) => {
  try {
    const { userId, unitId, progressPercentage, completed } = req.body;

    if (!userId || !unitId || progressPercentage === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const success = await updateLearningProgress(
      userId,
      unitId,
      progressPercentage,
      completed || false
    );

    res.json({
      success,
      message: completed ? "Unit completed!" : "Progress updated"
    });

  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

/**
 * GET /api/learning/concept/:userId/:conceptName
 * Get concept details with prerequisites and user mastery
 */
router.get("/concept/:userId/:conceptName", async (req, res) => {
  try {
    const { userId, conceptName } = req.params;

    const conceptData = await getConceptMasteryWithPrerequisites(
      userId,
      decodeURIComponent(conceptName)
    );

    if (!conceptData) {
      return res.status(404).json({ error: "Concept not found" });
    }

    res.json({
      success: true,
      ...conceptData
    });

  } catch (error) {
    console.error("Error getting concept:", error);
    res.status(500).json({ error: "Failed to get concept" });
  }
});

/**
 * GET /api/learning/next-review/:userId
 * Get concepts due for spaced repetition review
 */
router.get("/next-review/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // This uses existing progressService functionality
    const { data: dueForReview } = await supabase
      .from('concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true })
      .limit(10);

    res.json({
      success: true,
      concepts: dueForReview || [],
      count: (dueForReview || []).length
    });

  } catch (error) {
    console.error("Error getting review concepts:", error);
    res.status(500).json({ error: "Failed to get review concepts" });
  }
});

/**
 * POST /api/learning/delete-path
 * Delete a learning path by source name
 */
router.post("/delete-path", async (req, res) => {
  try {
    const { userId, sourceName } = req.body;

    if (!userId || !sourceName) {
      return res.status(400).json({ error: "Missing userId or sourceName" });
    }

    console.log(`Deleting path for user ${userId}, source: ${sourceName}`);

    // Find all units for this source
    const { data: units } = await supabase
      .from('learning_units')
      .select('id')
      .eq('user_id', userId)
      .eq('source_name', sourceName);

    if (!units || units.length === 0) {
      return res.status(404).json({ error: "Learning path not found" });
    }

    const unitIds = units.map(u => u.id);
    console.log(`Found ${unitIds.length} units to delete`);

    // Delete highlights first (foreign key)
    const { error: highlightsError } = await supabase
      .from('unit_highlights')
      .delete()
      .in('unit_id', unitIds);
    
    if (highlightsError) console.error('Highlights delete error:', highlightsError);

    // Delete notes
    const { error: notesError } = await supabase
      .from('unit_notes')
      .delete()
      .in('unit_id', unitIds);
    
    if (notesError) console.error('Notes delete error:', notesError);

    // Delete user learning paths
    await supabase
      .from('user_learning_paths')
      .delete()
      .eq('user_id', userId)
      .in('learning_unit_id', unitIds);

    // Delete learning units
    await supabase
      .from('learning_units')
      .delete()
      .eq('user_id', userId)
      .eq('source_name', sourceName);

    console.log(`Successfully deleted path: ${sourceName}`);

    res.json({
      success: true,
      deletedUnits: unitIds.length,
      message: `Deleted ${unitIds.length} learning units`
    });

  } catch (error) {
    console.error("Error deleting path:", error);
    res.status(500).json({ error: "Failed to delete learning path" });
  }
});

export default router;
