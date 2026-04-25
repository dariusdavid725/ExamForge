import {
  answersEquivalent,
  normalizeAnswer
} from "./textUtils.js";

function normalizeSet(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map(value => normalizeAnswer(value))
      .filter(Boolean)
  );
}

function exactSetEquals(a, b) {
  if (a.size !== b.size) return false;

  for (const item of a) {
    if (!b.has(item)) return false;
  }

  return true;
}

export function evaluateAnswer(challenge, selectedAnswer) {
  if (!challenge) {
    return {
      correct: false,
      partial: false,
      ratio: 0
    };
  }

  if (
    challenge.type === "multiple_choice" ||
    challenge.type === "true_false" ||
    challenge.type === "spot_mistake"
  ) {
    const ok = selectedAnswer === challenge.correctAnswer;

    return {
      correct: ok,
      partial: false,
      ratio: ok ? 1 : 0
    };
  }

  if (challenge.type === "fill_blank") {
    const accepted = [
      challenge.correctAnswer,
      ...(challenge.acceptedAnswers || [])
    ];

    const ok = accepted.some(answer => answersEquivalent(answer, selectedAnswer));

    return {
      correct: ok,
      partial: false,
      ratio: ok ? 1 : 0
    };
  }

  if (challenge.type === "order_steps") {
    if (!Array.isArray(selectedAnswer)) {
      return {
        correct: false,
        partial: false,
        ratio: 0
      };
    }

    if (selectedAnswer.length !== challenge.correctOrder.length) {
      return {
        correct: false,
        partial: false,
        ratio: 0
      };
    }

    let correctPositions = 0;

    challenge.correctOrder.forEach((step, index) => {
      if (answersEquivalent(step, selectedAnswer[index])) {
        correctPositions += 1;
      }
    });

    const ratio = correctPositions / challenge.correctOrder.length;

    return {
      correct: ratio === 1,
      partial: ratio > 0 && ratio < 1,
      ratio
    };
  }

  if (challenge.type === "matching") {
    if (!Array.isArray(selectedAnswer)) {
      return {
        correct: false,
        partial: false,
        ratio: 0
      };
    }

    const total = challenge.pairs.length;
    let correct = 0;

    for (const { left, right } of challenge.pairs) {
      const selected = selectedAnswer.find(item => {
        return answersEquivalent(item.left, left);
      });

      if (selected && answersEquivalent(selected.right, right)) {
        correct += 1;
      }
    }

    const ratio = total > 0 ? correct / total : 0;

    return {
      correct: ratio === 1,
      partial: ratio > 0 && ratio < 1,
      ratio
    };
  }

  if (challenge.type === "multiple_select") {
    const correctSet = normalizeSet(challenge.correctAnswers);
    const selectedSet = normalizeSet(selectedAnswer);

    if (correctSet.size === 0) {
      return {
        correct: false,
        partial: false,
        ratio: 0
      };
    }

    if (exactSetEquals(correctSet, selectedSet)) {
      return {
        correct: true,
        partial: false,
        ratio: 1
      };
    }

    let hits = 0;
    let wrong = 0;

    for (const selected of selectedSet) {
      if (correctSet.has(selected)) {
        hits += 1;
      } else {
        wrong += 1;
      }
    }

    const rawRatio = (hits - wrong * 0.5) / correctSet.size;
    const ratio = Math.max(0, Math.min(1, rawRatio));

    return {
      correct: false,
      partial: ratio > 0,
      ratio
    };
  }

  return {
    correct: false,
    partial: false,
    ratio: 0
  };
}

export function isAnswerCorrect(challenge, selectedAnswer) {
  return evaluateAnswer(challenge, selectedAnswer).correct;
}

export function getCorrectAnswerDisplay(challenge) {
  if (challenge.type === "order_steps") {
    return challenge.correctOrder.join(" → ");
  }

  if (challenge.type === "matching") {
    return challenge.pairs.map(pair => `${pair.left} → ${pair.right}`).join(", ");
  }

  if (challenge.type === "multiple_select") {
    return challenge.correctAnswers.join(", ");
  }

  return challenge.correctAnswer;
}

export function calculatePoints(timeLeft, ratio = 1) {
  if (ratio <= 0) return 0;

  const speedBonus = Math.max(0, Math.min(50, Number(timeLeft || 0)));

  return Math.round((100 + speedBonus) * ratio);
}