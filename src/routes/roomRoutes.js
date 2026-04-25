import express from "express";
import {
  getRoom,
  createRoom,
  addPlayerToRoom,
  startRoom,
  getPlayer,
  updatePlayer,
  finishRoomIfAllDone,
  fastForwardToResultIfAllAnswered,
  forceNextForSinglePlayer
} from "../services/roomService.js";
import {
  QUESTION_TIME_SECONDS,
  RESULT_DURATION_SECONDS,
  LEADERBOARD_DURATION_SECONDS
} from "../config/constants.js";
import { normalizeLearningPack } from "../validators/packValidator.js";
import { generateRecoveryLessonWithAI } from "../services/aiService.js";
import {
  evaluateAnswer,
  getCorrectAnswerDisplay,
  calculatePoints
} from "../utils/scoring.js";

const router = express.Router();

function getCycleMs() {
  return (
    QUESTION_TIME_SECONDS +
    RESULT_DURATION_SECONDS +
    LEADERBOARD_DURATION_SECONDS
  ) * 1000;
}

function playerAnsweredChallenge(player, challengeIndex) {
  return (player.answers || []).some(answer => {
    return Number(answer.challengeIndex) === Number(challengeIndex);
  });
}

router.post("/", async (req, res) => {
  try {
    const rawPack = req.body.pack || req.body.quiz;

    if (!rawPack) {
      return res.status(400).json({
        error: "Learning pack invalid."
      });
    }

    let normalizedPack;

    if (Array.isArray(rawPack.challenges)) {
      normalizedPack = normalizeLearningPack(rawPack);
    } else if (Array.isArray(rawPack.questions)) {
      normalizedPack = normalizeLearningPack({
        title: rawPack.title,
        summary: rawPack.summary,
        concepts: rawPack.concepts,
        category: rawPack.category,
        challenges: rawPack.questions
      });
    } else {
      return res.status(400).json({
        error: "Learning pack invalid."
      });
    }

    const room = await createRoom(normalizedPack);

    return res.json({
      code: room.code,
      room: {
        code: room.code,
        status: room.status,
        packTitle: normalizedPack.title,
        players: []
      }
    });
  } catch (error) {
    console.error("EROARE create room:", error);

    return res.status(500).json({
      error: "Nu am putut crea camera."
    });
  }
});

router.get("/:code", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    let allAnsweredCurrentQuestion = false;
    let currentChallengeIndex = 0;

    if (room.status === "started" && room.started_at && room.pack?.challenges?.length) {
      const cycleMs = getCycleMs();
      const elapsed = Date.now() - Number(room.started_at);

      currentChallengeIndex = Math.min(
        Math.floor(elapsed / cycleMs),
        room.pack.challenges.length - 1
      );

      allAnsweredCurrentQuestion =
        room.players.length > 0 &&
        room.players.every(player => {
          return playerAnsweredChallenge(player, currentChallengeIndex);
        });
    }

    return res.json({
      code: room.code,
      status: room.status,
      packTitle: room.pack.title,
      packSummary: room.pack.summary,
      quizTitle: room.pack.title,
      quizSummary: room.pack.summary,
      concepts: room.pack.concepts,
      startedAt: room.started_at,
      endsAt: room.ends_at,
      questionTime: room.question_time,
      totalChallenges: room.pack.challenges.length,
      allAnsweredCurrentQuestion,
      currentChallengeIndex,
      players: room.players.map(player => ({
        id: player.id,
        userId: player.userId || null,
        name: player.name,
        score: player.score,
        finished: player.finished,
        totalAnswered: player.totalAnswered
      }))
    });
  } catch (error) {
    console.error("EROARE get room:", error);

    return res.status(500).json({
      error: "Eroare server."
    });
  }
});

router.post("/:code/join", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({
        error: "Arena a început deja."
      });
    }

    const name = String(req.body.name || "").trim();
    const userId = req.body.userId || null;

    if (!name) {
      return res.status(400).json({
        error: "Introdu un nume."
      });
    }

    const player = await addPlayerToRoom(room.code, name, userId);

    return res.json({
      playerId: player.id,
      room: {
        code: room.code,
        status: room.status,
        packTitle: room.pack.title,
        players: [...room.players, player]
      }
    });
  } catch (error) {
    console.error("EROARE join room:", error);

    return res.status(500).json({
      error: "Nu am putut intra în cameră."
    });
  }
});

router.post("/:code/start", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({
        error: "Arena a început deja."
      });
    }

    const result = await startRoom(room.code);

    return res.json({
      ok: true,
      status: result.status,
      startedAt: result.startedAt,
      endsAt: result.endsAt,
      questionTime: result.questionTime
    });
  } catch (error) {
    console.error("EROARE start room:", error);

    return res.status(500).json({
      error: "Nu am putut porni arena."
    });
  }
});

router.get("/:code/pack", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    if (room.status !== "started" && room.status !== "finished") {
      return res.status(400).json({
        error: "Arena nu a început încă."
      });
    }

    return res.json({
      pack: room.pack,
      startedAt: room.started_at,
      endsAt: room.ends_at,
      questionTime: room.question_time
    });
  } catch (error) {
    console.error("EROARE get pack:", error);

    return res.status(500).json({
      error: "Eroare server."
    });
  }
});

router.get("/:code/quiz", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    if (room.status !== "started" && room.status !== "finished") {
      return res.status(400).json({
        error: "Arena nu a început încă."
      });
    }

    return res.json({
      quiz: {
        title: room.pack.title,
        summary: room.pack.summary,
        category: room.pack.category,
        concepts: room.pack.concepts,
        questions: room.pack.challenges
      },
      pack: room.pack,
      startedAt: room.started_at,
      endsAt: room.ends_at,
      questionTime: room.question_time
    });
  } catch (error) {
    console.error("EROARE get quiz:", error);

    return res.status(500).json({
      error: "Eroare server."
    });
  }
});

router.post("/:code/submit", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    if (room.status === "finished") {
      return res.status(400).json({
        error: "Arena s-a terminat."
      });
    }

    const { playerId, challengeIndex, questionIndex, selectedAnswer, timeLeft } = req.body;

    const index =
      typeof challengeIndex === "number"
        ? challengeIndex
        : typeof questionIndex === "number"
          ? questionIndex
          : -1;

    const player = await getPlayer(playerId);

    if (!player) {
      return res.status(404).json({
        error: "Player inexistent."
      });
    }

    const challenge = room.pack.challenges[index];

    if (!challenge) {
      return res.status(400).json({
        error: "Challenge invalid."
      });
    }

    const answers = player.answers || [];

    const alreadyAnswered = answers.some(answer => {
      return Number(answer.challengeIndex) === Number(index);
    });

    if (alreadyAnswered) {
      return res.status(400).json({
        error: "Ai răspuns deja la challenge-ul acesta."
      });
    }

    const evaluation = evaluateAnswer(challenge, selectedAnswer);
    const points = calculatePoints(timeLeft, evaluation.ratio);

    const newAnswer = {
      challengeIndex: index,
      selectedAnswer,
      correctAnswer: getCorrectAnswerDisplay(challenge),
      isCorrect: evaluation.correct,
      isPartial: evaluation.partial,
      ratio: evaluation.ratio,
      points,
      concept: challenge.concept,
      type: challenge.type,
      answeredAt: Date.now()
    };

    const newTotalAnswered = (player.total_answered || 0) + 1;
    const newScore = (player.score || 0) + points;
    const newCorrect = (player.correct || 0) + (evaluation.correct ? 1 : 0);

    const newWeakConcepts = evaluation.correct
      ? player.weak_concepts || []
      : [...(player.weak_concepts || []), challenge.concept || "Unknown concept"];

    await updatePlayer(playerId, {
      score: newScore,
      correct: newCorrect,
      total_answered: newTotalAnswered,
      finished: newTotalAnswered >= room.pack.challenges.length,
      answers: [...answers, newAnswer],
      weak_concepts: newWeakConcepts
    });

    const fastForward = await fastForwardToResultIfAllAnswered(room.code, index);

    await finishRoomIfAllDone(room.code);

    return res.json({
      isCorrect: evaluation.correct,
      isPartial: evaluation.partial,
      ratio: evaluation.ratio,
      points,
      score: newScore,
      correctAnswer: getCorrectAnswerDisplay(challenge),
      explanation: challenge.explanation,
      sourceSnippet: challenge.sourceSnippet,
      type: challenge.type,
      correctAnswers: challenge.correctAnswers || [],
      pairs: challenge.pairs || [],
      startedAt: fastForward?.startedAt || room.started_at,
      endsAt: fastForward?.endsAt || room.ends_at
    });
  } catch (error) {
    console.error("EROARE submit:", error);

    return res.status(500).json({
      error: "Eroare la trimiterea răspunsului."
    });
  }
});

router.post("/:code/next", async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        error: "Player missing."
      });
    }

    const result = await forceNextForSinglePlayer(req.params.code, playerId);

    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("EROARE next solo:", error);

    return res.status(400).json({
      error: error.message || "Nu am putut trece la următoarea întrebare."
    });
  }
});

router.get("/:code/leaderboard", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    const leaderboard = [...room.players]
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        rank: index + 1,
        id: player.id,
        userId: player.userId || null,
        name: player.name,
        score: player.score,
        correct: player.correct,
        totalAnswered: player.totalAnswered,
        finished: player.finished,
        weakConcepts: [...new Set(player.weakConcepts)]
      }));

    const conceptCounts = {};

    room.players.forEach(player => {
      player.weakConcepts.forEach(concept => {
        conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
      });
    });

    const weakConcepts = Object.entries(conceptCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, count]) => ({
        concept,
        count
      }));

    return res.json({
      leaderboard,
      weakConcepts,
      endsAt: room.ends_at,
      totalChallenges: room.pack.challenges.length
    });
  } catch (error) {
    console.error("EROARE leaderboard:", error);

    return res.status(500).json({
      error: "Eroare server."
    });
  }
});

router.post("/:code/lesson", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Camera nu există."
      });
    }

    const { playerId } = req.body;
    const player = room.players.find(p => p.id === playerId);

    if (!player) {
      return res.status(404).json({
        error: "Player inexistent."
      });
    }

    const lesson = await generateRecoveryLessonWithAI(room, player);

    return res.json({
      lesson,
      aiOnly: true
    });
  } catch (error) {
    console.error("EROARE recovery lesson:", error);

    return res.status(503).json({
      error: error.message || "AI-ul nu a putut genera lecția acum."
    });
  }
});

export default router;