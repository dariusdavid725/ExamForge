// Lessons saved in Supabase via /api/user-lessons

export async function saveLessonToStorage(lesson, documentText, userId) {
  const res = await fetch("/api/user-lessons", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, lesson, documentText })
  });
  if (!res.ok) throw new Error("Nu am putut salva lectia.");
  return normalize(await res.json());
}

export async function getLessonsFromStorage(userId) {
  if (!userId) return [];
  const res = await fetch(`/api/user-lessons?userId=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(normalize);
}

export async function updateLessonProgress(id, userId, { percentage, reviewTopics = [] }) {
  await fetch(`/api/user-lessons/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, percentage, reviewTopics })
  });
}

export async function deleteLessonFromStorage(id, userId) {
  await fetch(`/api/user-lessons/${id}?userId=${userId}`, { method: "DELETE" });
}

function normalize(row) {
  return {
    id:            row.id,
    title:         row.custom_title || row.auto_title || row.title || "Lesson",
    displayTitle:  row.custom_title || row.auto_title || row.title || "Lesson",
    customTitle:   row.custom_title || null,
    autoTitle:     row.auto_title   || null,
    language:      row.language     || "Unknown",
    createdAt:     row.created_at,
    lesson:        row.lesson,
    documentText:  row.document_text  || "",
    lastQuizScore: row.last_quiz_score ?? null,
    lastQuizDate:  row.last_quiz_date  ?? null,
    reviewTopics:  row.review_topics   || [],
    categoryId:    row.category_id  || null
  };
}

export async function renameLesson(id, userId, customTitle) {
  await fetch(`/api/user-lessons/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, customTitle })
  });
}

export async function moveLessonToCategory(id, userId, categoryId) {
  await fetch(`/api/user-lessons/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, categoryId })
  });
}
