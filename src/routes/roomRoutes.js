import express from "express";
import { getRoom, createRoom, addPlayerToRoom, startRoom, finishRoomIfAllDone } from "../services/roomService.js";
import { normalizeLearningPack } from "../validators/packValidator.js";
import { generateRecoveryLessonWithAI } from "../services/aiService.js";
import { isAnswerCorrect, getCorrectAnswerDisplay, calculatePoints } from "../utils/scoring.js";

const router = express.Router();

router.post("/", (req, res) => {
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

    const room = createRoom(normalizedPack);

    return res.json({
      code: room.code,
      room: {
        code: room.code,
        status: room.status,
        packTitle: normalizedPack.title,
        players: room.players
      }
    });
  } catch (error) {
    console.error("EROARE create room:", error);
    return res.status(500).json({ error: "Nu am putut crea camera." });
  }
});

router.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);

  if (!room) {
    return res.status(404).json({ error: "Camera nu există." });
  }

  return res.json({
    code: room.code,
    status: room.status,
    packTitle: room.pack.title,
    packSummary: room.pack.summary,
    quizTitle: room.pack.title,
    quizSummary: room.pack.summary,
    concepts: room.pack.concepts,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    questionTime: room.questionTime,
    totalChallenges: room.pack.challenges.length,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      finished: p.finished
    }))
  });
});

router.post("/:code/join", (req, res) => {
  const room = getRoom(req.params.code);

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

  const player = addPlayerToRoom(room, name);

  return res.json({
    playerId: player.id,
    room: {
      code: room.code,
      status: room.status,
      packTitle: room.pack.title,
      players: room.players
    }
  });
});

router.post("/:code/start", (req, res) => {
  const room = getRoom(req.params.code);

  if (!room) {
    return res.status(404).json({ error: "Camera nu există." });
  }

  // Bug fix: prevent double-start resetting endsAt mid-game
  if (room.status !== "lobby") {
    return res.status(400).json({ error: "Arena a început deja." });
  }

  startRoom(room);

  return res.json({
    ok: true,
    status: room.status,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    questionTime: room.questionTime
  });
});

router.get("/:code/pack", (req, res) => {
  const room = getRoom(req.params.code);

  if (!room) {
    return res.status(404).json({ error: "Camera nu există." });
  }

  if (room.status !== "started" && room.status !== "finished") {
    return res.status(400).json({ error: "Arena nu a început încă." });
  }

  return res.json({
    pack: room.pack,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    questionTime: room.questionTime
  });
});

router.get("/:code/quiz", (req, res) => {
  const room = getRoom(req.params.code);

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
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    questionTime: room.questionTime
  });
});

router.post("/:code/submit", (req, res) => {
  const room = getRoom(req.params.code);

  if (!room) {
    return res.status(404).json({ error: "Camera nu există." });
  }

  const { playerId, challengeIndex, questionIndex, selectedAnswer, timeLeft } = req.body;

  const index =
    typeof challengeIndex === "number"
      ? challengeIndex
      : typeof questionIndex === "number"
        ? questionIndex
        : -1;

  const player = room.players.find(p => p.id === playerId);

  if (!player) {
    return res.status(404).json({ error: "Player inexistent." });
  }

  const challenge = room.pack.challenges[index];

  if (!challenge) {
    return res.status(400).json({ error: "Challenge invalid." });
  }

  // Bug fix: reject submissions after room finishes
  if (room.status === "finished") {
    return res.status(400).json({ error: "Arena s-a terminat." });
  }

  const alreadyAnswered = player.answers.some(a => a.challengeIndex === index);

  if (alreadyAnswered) {
    return res.status(400).json({ error: "Ai răspuns deja la challenge-ul acesta." });
  }

  const correct = isAnswerCorrect(challenge, selectedAnswer);
  const points = correct ? calculatePoints(timeLeft) : 0;

  if (correct) {
    player.score += points;
    player.correct += 1;
  } else {
    player.weakConcepts.push(challenge.concept || "Unknown concept");
  }

  player.totalAnswered += 1;
  player.answers.push({
    challengeIndex: index,
    selectedAnswer,
    correctAnswer: getCorrectAnswerDisplay(challenge),
    isCorrect: correct,
    points,
    concept: challenge.concept,
    type: challenge.type,
    answeredAt: Date.now()
  });

  if (player.totalAnswered >= room.pack.challenges.length) {
    player.finished = true;
  }

  finishRoomIfAllDone(room);

  return res.json({
    isCorrect: correct,
    points,
    score: player.score,
    correctAnswer: getCorrectAnswerDisplay(challenge),
    explanation: challenge.explanation,
    sourceSnippet: challenge.sourceSnippet,
    type: challenge.type
  });
});

router.get("/:code/leaderboard", (req, res) => {
  const room = getRoom(req.params.code);

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
    endsAt: room.endsAt,
    totalChallenges: room.pack.challenges.length
  });
});

router.post("/:code/lesson", async (req, res) => {
  try {
    const room = getRoom(req.params.code);

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
      error:
        error.message ||
        "AI-ul nu a putut genera lecția acum. Încearcă alt API key sau așteaptă resetarea limitei."
    });
  }
});

export default router;
