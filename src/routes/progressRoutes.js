import express from "express";
import { getUserProgressStats, getConceptsDueForReview } from "../services/progressService.js";

const router = express.Router();

// GET /api/progress/stats
router.get("/stats", async (req, res) => {
  try {
    const { userId, days } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const stats = await getUserProgressStats(userId, parseInt(days) || 7);

    return res.json(stats || {
      dailyProgress: [],
      currentStreak: 0,
      longestStreak: 0,
      totalQuizzes: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      overallAccuracy: 0
    });

  } catch (error) {
    console.error("Error getting progress stats:", error);
    return res.status(500).json({ error: "Failed to get progress stats" });
  }
});

// GET /api/progress/review-due
router.get("/review-due", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const concepts = await getConceptsDueForReview(userId);

    return res.json({ concepts });

  } catch (error) {
    console.error("Error getting review concepts:", error);
    return res.status(500).json({ error: "Failed to get review concepts" });
  }
});

export default router;
