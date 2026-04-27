import { nav } from "../shared/nav.js";

const QUESTIONS = [
  {
    prompt: "Which process allows plants to convert light into chemical energy?",
    options: ["Respiration", "Photosynthesis", "Fermentation", "Digestion"],
    answer: 1
  },
  {
    prompt: "What is the main purpose of DNA in living organisms?",
    options: ["Store genetic information", "Transport oxygen", "Break down proteins", "Regulate body temperature"],
    answer: 0
  },
  {
    prompt: "If a function runs in O(log n), what does this imply for growth?",
    options: ["Linear growth", "Constant growth", "Slowly increasing growth", "Quadratic growth"],
    answer: 2
  },
  {
    prompt: "Which statement best defines inflation in economics?",
    options: ["Decrease in employment", "General rise in prices over time", "Increase in exports only", "Lower interest rates only"],
    answer: 1
  },
  {
    prompt: "In effective learning, retrieval practice means:",
    options: ["Re-reading notes repeatedly", "Highlighting every paragraph", "Actively recalling information from memory", "Watching lessons passively"],
    answer: 2
  }
];

const state = {
  index: 0,
  score: 0
};

const el = id => document.getElementById(id);

function trackEvent(name, meta = {}) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, source: "demo", meta })
  }).catch(() => {});
}

function resetQuiz() {
  state.index = 0;
  state.score = 0;
}

function renderQuestion() {
  const question = QUESTIONS[state.index];
  if (!question) return showResult();

  el("demoProgressText").textContent = `Question ${state.index + 1} of ${QUESTIONS.length}`;
  el("demoQuestionText").textContent = question.prompt;

  const optionsContainer = el("demoOptions");
  optionsContainer.innerHTML = "";

  question.options.forEach((option, optionIndex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary";
    btn.style.textAlign = "left";
    btn.textContent = option;
    btn.addEventListener("click", () => handleAnswer(optionIndex));
    optionsContainer.appendChild(btn);
  });
}

function handleAnswer(selectedIndex) {
  const current = QUESTIONS[state.index];
  const correct = selectedIndex === current.answer;

  if (correct) {
    state.score += 1;
  }

  trackEvent("activation_demo_answered", {
    questionNumber: state.index + 1,
    correct
  });

  state.index += 1;
  renderQuestion();
}

function showResult() {
  el("demoQuiz").classList.add("hidden");
  el("demoResult").classList.remove("hidden");

  const score = state.score;
  const total = QUESTIONS.length;
  const percent = Math.round((score / total) * 100);

  el("demoScoreText").textContent = `You scored ${score}/${total} (${percent}%).`;
  el("demoSummaryText").textContent = score >= 4
    ? "Strong start. Create a full arena from your own topic or document."
    : "Great start. Create a full arena to practice your weak spots with AI-generated questions.";

  trackEvent("activation_demo_completed", { score, total, percent });
}

function startDemo() {
  resetQuiz();
  el("demoIntro").classList.add("hidden");
  el("demoResult").classList.add("hidden");
  el("demoQuiz").classList.remove("hidden");
  renderQuestion();
  trackEvent("activation_demo_started");
}

function init() {
  document.getElementById("brandLogo")?.addEventListener("click", nav.home);
  el("startDemoBtn")?.addEventListener("click", startDemo);
  el("retryDemoBtn")?.addEventListener("click", startDemo);
}

init();
