import express from "express";
import {
  getRoom,
  createRoom,
  addPlayerToRoom,
  startRoom,
  getPlayer,
  updatePlayer,
  finishRoomIfAllDone
} from "../services/roomService.js";
import { QUESTION_TIME_SECONDS, RESULT_DURATION_SECONDS, LEADERBOARD_DURATION_SECONDS } from "../config/constants.js";
import { normalizeLearningPack } from "../validators/packValidator.js";
import { generateRecoveryLessonWithAI } from "../services/aiService.js";
import { isAnswerCorrect, getCorrectAnswerDisplay, calculatePoints } from "../utils/scoring.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const rawPack = req.body.pack || req.body.quiz;

    if (!rawPack) {
      return res.status(400).json({ error: "Learning pack invalid." });
    }

    let normalizedPack;

    if (Array.isArray(rawPack.challenges)) {
      normalizedPack = normalizeLearningPack(rawPack);
    } else if (Array.isArray(rawPack.questions)) {
      normalizedPack = normalizeLearningPack({
        title: rawPack.title,
        summary: rawPack.summary,
        concepts: rawPack.concepts,
        challenges: rawPack.questions
      });
    } else {
      return res.status(400).json({ error: "Learning pack invalid." });
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
    return res.status(500).json({ error: "Nu am putut crea camera." });
  }
});

router.get("/:code", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    // Detect if all players have answered the current question
    let allAnsweredCurrentQuestion = false;
    let currentChallengeIndex = 0;

    if (room.status === "started" && room.started_at && room.pack?.challenges?.length) {
      const cycleMs = (QUESTION_TIME_SECONDS + RESULT_DURATION_SECONDS + LEADERBOARD_DURATION_SECONDS) * 1000;
      const elapsed = Date.now() - room.started_at;
      currentChallengeIndex = Math.min(
        Math.floor(elapsed / cycleMs),
        room.pack.challenges.length - 1
      );
      allAnsweredCurrentQuestion =
        room.players.length > 0 &&
        room.players.every(p => p.totalAnswered > currentChallengeIndex);
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
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        finished: p.finished,
        totalAnswered: p.totalAnswered
      }))
    });
  } catch (error) {
    console.error("EROARE get room:", error);
    return res.status(500).json({ error: "Eroare server." });
  }
});

router.post("/:code/join", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({ error: "Arena a început deja." });
    }

    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Introdu un nume." });
    }

    const player = await addPlayerToRoom(room.code, name);

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
    return res.status(500).json({ error: "Nu am putut intra în cameră." });
  }
});

router.post("/:code/start", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({ error: "Arena a început deja." });
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
    return res.status(500).json({ error: "Nu am putut porni arena." });
  }
});

router.get("/:code/pack", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    if (room.status !== "started" && room.status !== "finished") {
      return res.status(400).json({ error: "Arena nu a început încă." });
    }

    return res.json({
      pack: room.pack,
      startedAt: room.started_at,
      endsAt: room.ends_at,
      questionTime: room.question_time
    });
  } catch (error) {
    console.error("EROARE get pack:", error);
    return res.status(500).json({ error: "Eroare server." });
  }
});

router.get("/:code/quiz", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    if (room.status !== "started" && room.status !== "finished") {
      return res.status(400).json({ error: "Arena nu a început încă." });
    }

    return res.json({
      quiz: {
        title: room.pack.title,
        summary: room.pack.summary,
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
    return res.status(500).json({ error: "Eroare server." });
  }
});

router.post("/:code/submit", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    if (room.status === "finished") {
      return res.status(400).json({ error: "Arena s-a terminat." });
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
      return res.status(404).json({ error: "Player inexistent." });
    }

    const challenge = room.pack.challenges[index];

    if (!challenge) {
      return res.status(400).json({ error: "Challenge invalid." });
    }

    const answers = player.answers || [];
    const alreadyAnswered = answers.some(a => a.challengeIndex === index);

    if (alreadyAnswered) {
      return res.status(400).json({ error: "Ai răspuns deja la challenge-ul acesta." });
    }

    const correct = isAnswerCorrect(challenge, selectedAnswer);
    const points = correct ? calculatePoints(timeLeft) : 0;

    const newAnswer = {
      challengeIndex: index,
      selectedAnswer,
      correctAnswer: getCorrectAnswerDisplay(challenge),
      isCorrect: correct,
      points,
      concept: challenge.concept,
      type: challenge.type,
      answeredAt: Date.now()
    };

    const newTotalAnswered = (player.total_answered || 0) + 1;
    const newScore = (player.score || 0) + points;
    const newCorrect = (player.correct || 0) + (correct ? 1 : 0);
    const newWeakConcepts = correct
      ? (player.weak_concepts || [])
      : [...(player.weak_concepts || []), challenge.concept || "Unknown concept"];

    await updatePlayer(playerId, {
      score: newScore,
      correct: newCorrect,
      total_answered: newTotalAnswered,
      finished: newTotalAnswered >= room.pack.challenges.length,
      answers: [...answers, newAnswer],
      weak_concepts: newWeakConcepts
    });

    await finishRoomIfAllDone(room.code);

    return res.json({
      isCorrect: correct,
      points,
      score: newScore,
      correctAnswer: getCorrectAnswerDisplay(challenge),
      explanation: challenge.explanation,
      sourceSnippet: challenge.sourceSnippet,
      type: challenge.type
    });
  } catch (error) {
    console.error("EROARE submit:", error);
    return res.status(500).json({ error: "Eroare la trimiterea răspunsului." });
  }
});

router.get("/:code/leaderboard", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    const leaderboard = [...room.players]
      .sort((a, b) => b.score - a.score)
      .map((p, index) => ({
        rank: index + 1,
        id: p.id,
        name: p.name,
        score: p.score,
        correct: p.correct,
        totalAnswered: p.totalAnswered,
        finished: p.finished,
        weakConcepts: [...new Set(p.weakConcepts)]
      }));

    const conceptCounts = {};
    room.players.forEach(p => {
      p.weakConcepts.forEach(concept => {
        conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
      });
    });

    const weakConcepts = Object.entries(conceptCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, count]) => ({ concept, count }));

    return res.json({
      leaderboard,
      weakConcepts,
      endsAt: room.ends_at,
      totalChallenges: room.pack.challenges.length
    });
  } catch (error) {
    console.error("EROARE leaderboard:", error);
    return res.status(500).json({ error: "Eroare server." });
  }
});

router.post("/:code/lesson", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({ error: "Camera nu există." });
    }

    const { playerId } = req.body;
    const player = room.players.find(p => p.id === playerId);

    if (!player) {
      return res.status(404).json({ error: "Player inexistent." });
    }

    const lesson = await generateRecoveryLessonWithAI(room, player);

    return res.json({ lesson, aiOnly: true });
  } catch (error) {
    console.error("EROARE recovery lesson:", error);
    return res.status(503).json({
      error: error.message || "AI-ul nu a putut genera lecția acum."
    });
  }
});

export default router;
