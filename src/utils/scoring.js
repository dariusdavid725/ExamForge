import { normalizeAnswer } from "./textUtils.js";

export function isAnswerCorrect(challenge, selectedAnswer) {
  if (!challenge) return false;

  if (
    challenge.type === "multiple_choice" ||
    challenge.type === "true_false" ||
    challenge.type === "spot_mistake"
  ) {
    return selectedAnswer === challenge.correctAnswer;
  }

  if (challenge.type === "fill_blank") {
    const normalizedSelected = normalizeAnswer(selectedAnswer);
    const accepted = [challenge.correctAnswer, ...(challenge.acceptedAnswers || [])].map(normalizeAnswer);
    return accepted.includes(normalizedSelected);
  }

  if (challenge.type === "order_steps") {
    if (!Array.isArray(selectedAnswer)) return false;
    if (selectedAnswer.length !== challenge.correctOrder.length) return false;
    return challenge.correctOrder.every(
      (step, i) => normalizeAnswer(step) === normalizeAnswer(selectedAnswer[i])
    );
  }

  return false;
}

export function getCorrectAnswerDisplay(challenge) {
  if (challenge.type === "order_steps") {
    return challenge.correctOrder.join(" → ");
  }
  return challenge.correctAnswer;
}

export function calculatePoints(timeLeft) {
  const speedBonus = Math.max(0, Math.min(50, Number(timeLeft || 0)));
  return 100 + speedBonus;
}
