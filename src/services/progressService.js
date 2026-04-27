import { getSupabase } from "./supabaseServer.js";

const supabase = getSupabase();

/**
 * Update user's daily progress and streak
 */
export async function trackUserProgress(userId, activity) {
  if (!userId) return;

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    // 1. Upsert daily progress
    const { data: progressData } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    const updates = {
      user_id: userId,
      date: today,
      quizzes_completed: (progressData?.quizzes_completed || 0) + (activity.quizCompleted ? 1 : 0),
      lessons_completed: (progressData?.lessons_completed || 0) + (activity.lessonCompleted ? 1 : 0),
      total_questions_answered: (progressData?.total_questions_answered || 0) + (activity.questionsAnswered || 0),
      correct_answers: (progressData?.correct_answers || 0) + (activity.correctAnswers || 0),
      time_spent_minutes: (progressData?.time_spent_minutes || 0) + (activity.timeSpentMinutes || 0),
      concepts_learned: progressData?.concepts_learned || [],
      updated_at: new Date().toISOString()
    };

    // Add new concepts
    if (activity.concepts?.length) {
      const existingConcepts = new Set(updates.concepts_learned);
      activity.concepts.forEach(c => existingConcepts.add(c));
      updates.concepts_learned = Array.from(existingConcepts);
    }

    await supabase
      .from("user_progress")
      .upsert(updates, { onConflict: "user_id,date" });

    // 2. Update streak
    await updateStreak(userId, today);

    // 3. Update profile totals
    await supabase.rpc("increment_profile_stats", {
      p_user_id: userId,
      p_quizzes: activity.quizCompleted ? 1 : 0,
      p_questions: activity.questionsAnswered || 0,
      p_correct: activity.correctAnswers || 0
    }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase.from("profiles")
        .update({
          total_quizzes_completed: supabase.sql`total_quizzes_completed + ${activity.quizCompleted ? 1 : 0}`,
          total_questions_answered: supabase.sql`total_questions_answered + ${activity.questionsAnswered || 0}`,
          total_correct_answers: supabase.sql`total_correct_answers + ${activity.correctAnswers || 0}`
        })
        .eq("id", userId);
    });

  } catch (error) {
    console.error("Error tracking user progress:", error);
  }
}

/**
 * Update user's streak (current & longest)
 */
async function updateStreak(userId, today) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_activity_date, current_streak, longest_streak")
      .eq("id", userId)
      .single();

    if (!profile) return;

    const lastActivity = profile.last_activity_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;

    if (lastActivity === today) {
      // Same day — no change
      return;
    } else if (lastActivity === yesterdayStr) {
      // Consecutive day — increment
      newStreak = (profile.current_streak || 0) + 1;
    } else {
      // Streak broken — reset to 1
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, profile.longest_streak || 0);

    await supabase
      .from("profiles")
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_activity_date: today
      })
      .eq("id", userId);

  } catch (error) {
    console.error("Error updating streak:", error);
  }
}

/**
 * Track concept mastery for spaced repetition
 */
export async function trackConceptMastery(userId, concept, isCorrect) {
  if (!userId || !concept) return;

  try {
    const { data: existing } = await supabase
      .from("concept_mastery")
      .select("*")
      .eq("user_id", userId)
      .eq("concept", concept)
      .single();

    const timesSeen = (existing?.times_seen || 0) + 1;
    const timesCorrect = (existing?.times_correct || 0) + (isCorrect ? 1 : 0);
    const accuracy = timesSeen > 0 ? timesCorrect / timesSeen : 0;

    // Calculate mastery level (0-5)
    let masteryLevel = 0;
    if (accuracy >= 0.9 && timesSeen >= 5) masteryLevel = 5;
    else if (accuracy >= 0.8 && timesSeen >= 4) masteryLevel = 4;
    else if (accuracy >= 0.7 && timesSeen >= 3) masteryLevel = 3;
    else if (accuracy >= 0.6 && timesSeen >= 2) masteryLevel = 2;
    else if (accuracy >= 0.5) masteryLevel = 1;

    // Calculate next review date (spaced repetition)
    const intervals = [1, 3, 7, 14, 30]; // days
    const intervalDays = intervals[Math.min(masteryLevel, intervals.length - 1)];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);

    await supabase
      .from("concept_mastery")
      .upsert({
        user_id: userId,
        concept,
        times_seen: timesSeen,
        times_correct: timesCorrect,
        last_seen_at: new Date().toISOString(),
        next_review_at: nextReview.toISOString(),
        mastery_level: masteryLevel
      }, { onConflict: "user_id,concept" });

  } catch (error) {
    console.error("Error tracking concept mastery:", error);
  }
}

/**
 * Get user's progress stats
 */
export async function getUserProgressStats(userId, days = 7) {
  if (!userId) return null;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const { data: progress } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDateStr)
      .order("date", { ascending: true });

    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, longest_streak, total_quizzes_completed, total_questions_answered, total_correct_answers")
      .eq("id", userId)
      .single();

    const totalAccuracy = profile?.total_questions_answered > 0
      ? Math.round((profile.total_correct_answers / profile.total_questions_answered) * 100)
      : 0;

    return {
      dailyProgress: progress || [],
      currentStreak: profile?.current_streak || 0,
      longestStreak: profile?.longest_streak || 0,
      totalQuizzes: profile?.total_quizzes_completed || 0,
      totalQuestions: profile?.total_questions_answered || 0,
      totalCorrect: profile?.total_correct_answers || 0,
      overallAccuracy: totalAccuracy
    };

  } catch (error) {
    console.error("Error getting user progress stats:", error);
    return null;
  }
}

/**
 * Get concepts due for review (spaced repetition)
 */
export async function getConceptsDueForReview(userId) {
  if (!userId) return [];

  try {
    const now = new Date().toISOString();

    const { data: concepts } = await supabase
      .from("concept_mastery")
      .select("*")
      .eq("user_id", userId)
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(10);

    return concepts || [];

  } catch (error) {
    console.error("Error getting concepts due for review:", error);
    return [];
  }
}
