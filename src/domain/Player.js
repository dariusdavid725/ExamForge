export function makePlayer({ name, roomCode, userId = null }) {
  return {
    id: "p_" + Math.random().toString(36).slice(2, 10),
    name,
    room_code: String(roomCode).toUpperCase(),
    user_id: userId || null,
    score: 0,
    correct: 0,
    total_answered: 0,
    finished: false,
    abandoned: false,
    left_at: null,
    answers: [],
    weak_concepts: []
  };
}

export function normalizePlayer(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    createdAt: row.created_at != null ? Number(row.created_at) : null,
    name: row.name,
    score: row.score || 0,
    correct: row.correct || 0,
    totalAnswered: row.total_answered || 0,
    finished: Boolean(row.finished),
    abandoned: Boolean(row.abandoned),
    leftAt: row.left_at || null,
    answers: row.answers || [],
    weakConcepts: row.weak_concepts || []
  };
}
