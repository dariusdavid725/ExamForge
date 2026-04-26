import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function needsReset(resetDate) {
  if (!resetDate) return true;
  return getWeekStart(new Date()) > getWeekStart(new Date(resetDate));
}

export async function checkAndIncrementLimit(userId, type) {
  const admin = getAdmin();

  const { data: profile, error } = await admin.from("profiles")
    .select("plan, weekly_lessons_count, weekly_quizzes_count, weekly_reset_date")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return { allowed: false, error: "Profile not found." };
  if ((profile.plan || "free") === "premium") return { allowed: true, plan: "premium" };

  const reset = needsReset(profile.weekly_reset_date);
  const curLessons = reset ? 0 : (profile.weekly_lessons_count || 0);
  const curQuizzes = reset ? 0 : (profile.weekly_quizzes_count || 0);
  const LIMIT = 3;

  if (type === "lesson" && curLessons >= LIMIT) {
    return { allowed: false, limitReached: true, used: curLessons, limit: LIMIT, plan: "free" };
  }
  if (type === "quiz_creation" && curQuizzes >= LIMIT) {
    return { allowed: false, limitReached: true, used: curQuizzes, limit: LIMIT, plan: "free" };
  }

  const updates = { weekly_reset_date: new Date().toISOString().split("T")[0] };
  if (reset) {
    updates.weekly_lessons_count = type === "lesson" ? 1 : 0;
    updates.weekly_quizzes_count = type === "quiz_creation" ? 1 : 0;
  } else {
    if (type === "lesson") updates.weekly_lessons_count = curLessons + 1;
    if (type === "quiz_creation") updates.weekly_quizzes_count = curQuizzes + 1;
  }

  await admin.from("profiles").update(updates).eq("id", userId);
  return { allowed: true, plan: "free" };
}

export async function getUserPlan(userId) {
  if (!userId) return "free";
  const admin = getAdmin();
  const { data } = await admin.from("profiles")
    .select("plan").eq("id", userId).maybeSingle();
  return data?.plan || "free";
}
