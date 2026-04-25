import { normalizeAnswer } from "./textUtils.js";

// Returns { correct, partial, ratio }
export function evaluateAnswer(challenge, selectedAnswer) {
  if (!challenge) return { correct: false, partial: false, ratio: 0 };

  if (challenge.type === "multiple_choice" ||
      challenge.type === "true_false"      ||
      challenge.type === "spot_mistake") {
    const ok = selectedAnswer === challenge.correctAnswer;
    return { correct: ok, partial: false, ratio: ok ? 1 : 0 };
  }

  if (challenge.type === "fill_blank") {
    const norm = normalizeAnswer(selectedAnswer);
    const accepted = [challenge.correctAnswer, ...(challenge.acceptedAnswers || [])].map(normalizeAnswer);
    const ok = accepted.includes(norm);
    return { correct: ok, partial: false, ratio: ok ? 1 : 0 };
  }

  if (challenge.type === "order_steps") {
    if (!Array.isArray(selectedAnswer)) return { correct: false, partial: false, ratio: 0 };
    if (selectedAnswer.length !== challenge.correctOrder.length) return { correct: false, partial: false, ratio: 0 };
    const ok = challenge.correctOrder.every(
      (step, i) => normalizeAnswer(step) === normalizeAnswer(selectedAnswer[i])
    );
    return { correct: ok, partial: false, ratio: ok ? 1 : 0 };
  }

  if (challenge.type === "matching") {
    if (!Array.isArray(selectedAnswer)) return { correct: false, partial: false, ratio: 0 };
    const total   = challenge.pairs.length;
    let correct   = 0;
    for (const { left, right } of challenge.pairs) {
      const selected = selectedAnswer.find(s => normalizeAnswer(s.left) === normalizeAnswer(left));
      if (selected && normalizeAnswer(selected.right) === normalizeAnswer(right)) correct++;
    }
    const ratio = correct / total;
    return { correct: ratio === 1, partial: ratio > 0 && ratio < 1, ratio };
  }

  if (challenge.type === "multiple_select") {
    const correctSet = new Set(challenge.correctAnswers.map(normalizeAnswer));
    const selected   = Array.isArray(selectedAnswer) ? selectedAnswer.map(normalizeAnswer) : [];
    const hits        = selected.filter(s => correctSet.has(s)).length;
    const falsePos    = selected.filter(s => !correctSet.has(s)).length;
    const ratio       = Math.max(0, (hits - falsePos) / correctSet.size);
    return { correct: ratio === 1, partial: ratio > 0 && ratio < 1, ratio };
  }

  return { correct: false, partial: false, ratio: 0 };
}

export function isAnswerCorrect(challenge, selectedAnswer) {
  return evaluateAnswer(challenge, selectedAnswer).correct;
}

export function getCorrectAnswerDisplay(challenge) {
  if (challenge.type === "order_steps") return challenge.correctOrder.join(" → ");
  if (challenge.type === "matching")
    return challenge.pairs.map(p => `${p.left} → ${p.right}`).join(", ");
  if (challenge.type === "multiple_select")
    return challenge.correctAnswers.join(", ");
  return challenge.correctAnswer;
}

export function calculatePoints(timeLeft, ratio = 1) {
  if (ratio <= 0) return 0;
  const speedBonus = Math.max(0, Math.min(50, Number(timeLeft || 0)));
  return Math.round((100 + speedBonus) * ratio);
}
