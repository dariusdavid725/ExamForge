const KEY      = "ef_lessons";
const MAX_KEEP = 10;

export function saveLessonToStorage(lesson, documentText) {
  const all   = getLessonsFromStorage();
  const entry = {
    id:            Date.now().toString(),
    title:         lesson.title    || "Lesson",
    language:      lesson.language || "Unknown",
    createdAt:     new Date().toISOString(),
    lesson,
    documentText:  (documentText || "").slice(0, 8000),
    lastQuizScore: null,   // 0-100 percentage, null = never taken
    lastQuizDate:  null,
    reviewTopics:  []      // topics to review from gap analysis
  };

  const updated = [entry, ...all].slice(0, MAX_KEEP);

  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    try { localStorage.setItem(KEY, JSON.stringify([entry])); } catch {}
  }

  return entry;
}

export function getLessonsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function updateLessonProgress(id, { percentage, reviewTopics = [] }) {
  const all = getLessonsFromStorage();
  const idx = all.findIndex(l => l.id === id);
  if (idx === -1) return;

  all[idx] = {
    ...all[idx],
    lastQuizScore: percentage,
    lastQuizDate:  new Date().toISOString(),
    reviewTopics:  reviewTopics.slice(0, 8)
  };

  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function deleteLessonFromStorage(id) {
  const updated = getLessonsFromStorage().filter(l => l.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
}
