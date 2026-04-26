import express from "express";
import {
  getRoom,
  createRoom,
  addPlayerToRoom,
  startRoom,
  getPlayer,
  updatePlayer,
  finishRoomIfAllDone,
  finishRoomIfTimeExpired,
  advanceRoomAfterSubmit,
  getRoomTiming,
  closeRoom,
  leaveRoom
} from "../services/roomService.js";
import { normalizeLearningPack } from "../validators/packValidator.js";
import { generateRecoveryLessonWithAI } from "../services/aiService.js";
import {
  evaluateAnswer,
  getCorrectAnswerDisplay,
  calculatePoints
} from "../utils/scoring.js";

const router = express.Router();

// ─── In-memory reaction store (ephemeral, per room) ───────────────────────────

const reactionStore = new Map();

const ALLOWED_REACTIONS = new Set([
  "🔥","💪","👏","😎","🤔","😅","⚡","🏆","😱","🎯",
  "GG!","LFG!","Easy!","Tough!","Nice!","OMG!"
]);

function storeReaction(roomCode, reaction) {
  const key  = roomCode.toUpperCase();
  const list = reactionStore.get(key) || [];
  list.push({ ...reaction, id: `${Date.now()}-${Math.random()}`, ts: Date.now() });
  reactionStore.set(key, list.slice(-100));
}

function getReactions(roomCode, since = 0) {
  const key    = roomCode.toUpperCase();
  const cutoff = Math.max(since, Date.now() - 8000);
  return (reactionStore.get(key) || []).filter(r => r.ts > cutoff);
}

// ─────────────────────────────────────────────────────────────────────────────

function playerAnsweredChallenge(player, challengeIndex) {
  return (player.answers || []).some(answer => {
    return Number(answer.challengeIndex) === Number(challengeIndex);
  });
}

function activePlayers(room) {
  return (room.players || []).filter(player => !player.abandoned);
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
      error: "Could not create room."
    });
  }
});

router.get("/:code", async (req, res) => {
  try {
    let room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    const expired = await finishRoomIfTimeExpired(room.code);

    if (expired) {
      room = await getRoom(req.params.code);
    }

    const timing = getRoomTiming(room);
    const currentChallengeIndex = timing.currentChallengeIndex;
    const players = activePlayers(room);

    const allAnsweredCurrentQuestion =
      room.status === "started" &&
      players.length > 0 &&
      players.every(player => {
        return playerAnsweredChallenge(player, currentChallengeIndex);
      });

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
      serverNow: timing.serverNow,
      phase: timing.phase,
      timeLeft: timing.timeLeft,
      currentChallengeIndex: timing.currentChallengeIndex,
      totalChallenges: timing.totalChallenges,
      allAnsweredCurrentQuestion,
      players: players.map(player => ({
        id: player.id,
        userId: player.userId || null,
        name: player.name,
        score: player.score,
        finished: player.finished,
        totalAnswered: player.totalAnswered,
        abandoned: player.abandoned
      }))
    });
  } catch (error) {
    console.error("EROARE get room:", error);

    return res.status(500).json({
      error: "Server error."
    });
  }
});

router.post("/:code/join", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    if (room.status === "closed") {
      return res.status(400).json({
        error: "The arena has been closed."
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({
        error: "The arena has already started."
      });
    }

    const name = String(req.body.name || "").trim();
    const userId = req.body.userId || null;

    if (!name) {
      return res.status(400).json({
        error: "Please enter a name."
      });
    }

    const player = await addPlayerToRoom(room.code, name, userId);

    return res.json({
      playerId: player.id,
      serverNow: Date.now(),
      room: {
        code: room.code,
        status: room.status,
        packTitle: room.pack.title,
        players: [...activePlayers(room), player]
      }
    });
  } catch (error) {
    console.error("EROARE join room:", error);

    return res.status(500).json({
      error: "Could not join room."
    });
  }
});

router.post("/:code/start", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    if (room.status === "closed") {
      return res.status(400).json({
        error: "The arena has been closed."
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({
        error: "The arena has already started."
      });
    }

    const result = await startRoom(room.code);

    return res.json({
      ok: true,
      status: result.status,
      startedAt: result.startedAt,
      endsAt: result.endsAt,
      questionTime: result.questionTime,
      serverNow: result.serverNow
    });
  } catch (error) {
    console.error("EROARE start room:", error);

    return res.status(500).json({
      error: "Could not start arena."
    });
  }
});

router.post("/:code/close", async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        error: "Player missing."
      });
    }

    const result = await closeRoom(req.params.code, playerId);

    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("EROARE close room:", error);

    return res.status(400).json({
      error: error.message || "Could not close arena."
    });
  }
});

router.post("/:code/leave", async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        error: "Player missing."
      });
    }

    const result = await leaveRoom(req.params.code, playerId);

    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("EROARE leave room:", error);

    return res.status(400).json({
      error: error.message || "Could not leave arena."
    });
  }
});

router.get("/:code/pack", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    if (room.status === "closed") {
      return res.status(400).json({
        error: "The arena has been closed."
      });
    }

    if (room.status !== "started" && room.status !== "finished") {
      return res.status(400).json({
        error: "The arena has not started yet."
      });
    }

    const timing = getRoomTiming(room);

    return res.json({
      pack: room.pack,
      startedAt: room.started_at,
      endsAt: room.ends_at,
      questionTime: room.question_time,
      serverNow: timing.serverNow,
      phase: timing.phase,
      timeLeft: timing.timeLeft,
      currentChallengeIndex: timing.currentChallengeIndex
    });
  } catch (error) {
    console.error("EROARE get pack:", error);

    return res.status(500).json({
      error: "Server error."
    });
  }
});

router.post("/:code/submit", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    if (room.status === "closed") {
      return res.status(400).json({
        error: "The arena has been closed."
      });
    }

    if (room.status === "finished") {
      return res.status(400).json({
        error: "The arena has finished."
      });
    }

    const {
      playerId,
      challengeIndex,
      questionIndex,
      selectedAnswer,
      timeLeft
    } = req.body;

    const index =
      typeof challengeIndex === "number"
        ? challengeIndex
        : typeof questionIndex === "number"
          ? questionIndex
          : -1;

    const player = await getPlayer(playerId);

    if (!player) {
      return res.status(404).json({
        error: "Player not found."
      });
    }

    if (player.abandoned) {
      return res.status(400).json({
        error: "You have left the arena."
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
      const freshRoom = await getRoom(room.code);
      const timing = getRoomTiming(freshRoom);

      return res.json({
        alreadyAnswered: true,
        score: player.score || 0,
        startedAt: freshRoom.started_at,
        endsAt: freshRoom.ends_at,
        serverNow: timing.serverNow,
        phase: timing.phase,
        currentChallengeIndex: timing.currentChallengeIndex,
        timeLeft: timing.timeLeft
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

    const advance = await advanceRoomAfterSubmit(room.code, index);

    await finishRoomIfAllDone(room.code);

    const freshRoom = await getRoom(room.code);
    const timing = getRoomTiming(freshRoom);

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
      status: advance?.status || freshRoom.status,
      startedAt: advance?.startedAt || freshRoom.started_at,
      endsAt: advance?.endsAt || freshRoom.ends_at,
      serverNow: advance?.serverNow || timing.serverNow,
      phase: advance?.phase || timing.phase,
      currentChallengeIndex:
        typeof advance?.currentChallengeIndex === "number"
          ? advance.currentChallengeIndex
          : timing.currentChallengeIndex,
      timeLeft:
        typeof advance?.timeLeft === "number"
          ? advance.timeLeft
          : timing.timeLeft
    });
  } catch (error) {
    console.error("EROARE submit:", error);

    return res.status(500).json({
      error: "Error submitting answer."
    });
  }
});

router.get("/:code/leaderboard", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    if (room.status === "closed") {
      return res.status(400).json({
        error: "The arena has been closed."
      });
    }

    const timing = getRoomTiming(room);
    const players = activePlayers(room);

    const leaderboard = [...players]
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
        abandoned: player.abandoned,
        weakConcepts: [...new Set(player.weakConcepts)],
        answers: player.answers || []
      }));

    const conceptCounts = {};

    players.forEach(player => {
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
      serverNow: timing.serverNow,
      totalChallenges: room.pack.challenges.length
    });
  } catch (error) {
    console.error("EROARE leaderboard:", error);

    return res.status(500).json({
      error: "Server error."
    });
  }
});

router.post("/:code/lesson", async (req, res) => {
  try {
    const room = await getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found."
      });
    }

    const { playerId } = req.body;
    const player = room.players.find(p => p.id === playerId);

    if (!player) {
      return res.status(404).json({
        error: "Player not found."
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
      error: error.message || "The AI could not generate the lesson right now."
    });
  }
});

// ─── POST /:code/react ────────────────────────────────────────────────────────

router.post("/:code/react", async (req, res) => {
  try {
    const { playerId, reaction } = req.body;

    if (!reaction || !ALLOWED_REACTIONS.has(reaction)) {
      return res.status(400).json({ error: "Invalid reaction." });
    }

    const player = await getPlayer(playerId);
    if (!player) return res.status(404).json({ error: "Player not found." });

    storeReaction(req.params.code, {
      playerId,
      playerName: player.name,
      reaction
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Could not send reaction." });
  }
});

// ─── GET /:code/reactions ─────────────────────────────────────────────────────

router.get("/:code/reactions", (req, res) => {
  const since = Number(req.query.since) || 0;
  return res.json({ reactions: getReactions(req.params.code, since) });
});

export default router;