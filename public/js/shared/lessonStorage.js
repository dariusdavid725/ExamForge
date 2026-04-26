const KEY      = "ef_lessons";
const MAX_KEEP = 10;

export function saveLessonToStorage(lesson, documentText) {
  const all   = getLessonsFromStorage();
  const entry = {
    id:           Date.now().toString(),
    title:        lesson.title    || "Lesson",
    language:     lesson.language || "Unknown",
    createdAt:    new Date().toISOString(),
    lesson,
    documentText: (documentText || "").slice(0, 8000)
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

export function deleteLessonFromStorage(id) {
  const updated = getLessonsFromStorage().filter(l => l.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
}
