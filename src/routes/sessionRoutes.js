import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayDate() {
  return new Date(Date.now() - 86400000).toISOString().split("T")[0];
}

function normalizeLeaderboard(leaderboardData) {
  if (!leaderboardData || !Array.isArray(leaderboardData.leaderboard)) {
    return [];
  }

  return leaderboardData.leaderboard;
}

async function updateStatsForPlayer(userId, addedPoints) {
  if (!userId) return;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Could not load profile:", profileError);
    return;
  }

  if (!profile) {
    console.error("Profile missing for user:", userId);
    return;
  }

  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  const lastDate = profile.last_quiz_date;
  let streak = 1;

  if (lastDate === today) {
    streak = profile.streak_count || 1;
  } else if (lastDate === yesterday) {
    streak = (profile.streak_count || 0) + 1;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      streak_count: streak,
      max_streak: Math.max(streak, profile.max_streak || 0),
      last_quiz_date: today,
      total_quizzes: (profile.total_quizzes || 0) + 1,
      total_points: (profile.total_points || 0) + Number(addedPoints || 0)
    })
    .eq("id", userId);

  if (error) {
    console.error("Could not update profile stats:", error);
  }
}

async function updateStatsForAllLoggedPlayers(results) {
  const grouped = new Map();

  results.forEach(result => {
    if (!result.user_id) return;

    const current = grouped.get(result.user_id) || {
      score: 0
    };

    current.score += Number(result.score || 0);
    grouped.set(result.user_id, current);
  });

  for (const [userId, stats] of grouped.entries()) {
    await updateStatsForPlayer(userId, stats.score);
  }
}

router.post("/sessions/save", async (req, res) => {
  try {
    const {
      hostId,
      pack,
      roomCode,
      documentName,
      documentText,
      leaderboardData
    } = req.body;

    if (!hostId) {
      return res.status(400).json({
        error: "Missing hostId."
      });
    }

    if (!roomCode) {
      return res.status(400).json({
        error: "Missing roomCode."
      });
    }

    if (!pack || !Array.isArray(pack.challenges)) {
      return res.status(400).json({
        error: "Invalid pack."
      });
    }

    const leaderboard = normalizeLeaderboard(leaderboardData);

    const eligibleLeaderboard = leaderboard.filter(player => {
     return !player.abandoned && player.finished;
    });

    if (eligibleLeaderboard.length === 0) { {
      return res.status(400).json({
        error: "Missing leaderboard."
      });
    }

    const { data: existingSession } = await supabaseAdmin
      .from("game_sessions")
      .select("id")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (existingSession) {
      return res.json({
        ok: true,
        alreadySaved: true,
        sessionId: existingSession.id
      });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("game_sessions")
      .insert({
        host_id: hostId,
        room_code: roomCode,
        title: pack.title || "ExamForge Arena",
        category: pack.category || "General Knowledge",
        challenge_count: pack.challenges.length,
        document_name: documentName || "document",
        document_text: documentText || null,
        document_preview: documentText ? String(documentText).slice(0, 1500) : null,
        pack,
        conspect: pack.conspect || null,
        player_count: eligibleLeaderboard.length
      })
      .select()
      .single();

    if (sessionError) {
      console.error("game_sessions insert error:", sessionError);

      return res.status(500).json({
        error: sessionError.message || "Could not save session."
      });
    }

    const results = eligibleLeaderboard.map(player => ({
      session_id: session.id,
      user_id: player.userId || null,
      player_name: player.name || "Player",
      score: Number(player.score || 0),
      correct_count: Number(player.correct || 0),
      total_answered: Number(player.totalAnswered || 0),
      rank: Number(player.rank || 0),
      weak_concepts: player.weakConcepts || [],
      answers: player.answers || []
    }));

    const { error: resultsError } = await supabaseAdmin
      .from("game_results")
      .insert(results);

    if (resultsError) {
      console.error("game_results insert error:", resultsError);

      return res.status(500).json({
        error: resultsError.message || "Could not save results."
      });
    }

    await updateStatsForAllLoggedPlayers(results);

    return res.json({
      ok: true,
      sessionId: session.id
    });
  } catch (error) {
    console.error("save session route error:", error);

    return res.status(500).json({
      error: error.message || "Could not save session."
    });
  }
});

export default router;