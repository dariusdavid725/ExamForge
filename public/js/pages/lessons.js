import { installFeedback, showToast, showLoadingOverlay, updateLoadingOverlay, hideLoadingOverlay } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";

// ─── State ─────────────────────────────────────────────────────────────────────

let lesson       = null;
let documentText = null;
let quiz         = null;
let questionIdx  = 0;
let userAnswers  = [];
let score        = 0;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const el = id => document.getElementById(id);

function escapeHTML(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showSection(id) {
  ["uploadSection", "lessonSection", "quizSection", "reportSection"].forEach(s => {
    el(s)?.classList.toggle("hidden", s !== id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  installFeedback();
  installThemeToggle();
  await initHeader();
  setupUpload();
  setupButtons();
}

// ─── File upload ───────────────────────────────────────────────────────────────

function setupUpload() {
  const dropZone  = el("lessonDropZone");
  const fileInput = el("lessonFileInput");
  const nameLbl   = el("lessonFileName");

  const pick = file => { nameLbl.textContent = file.name; };

  dropZone?.addEventListener("click",    () => fileInput.click());
  dropZone?.addEventListener("dragover", e => e.preventDefault());
  dropZone?.addEventListener("drop", e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { fileInput.files = e.dataTransfer.files; pick(f); }
  });
  fileInput?.addEventListener("change", () => {
    if (fileInput.files[0]) pick(fileInput.files[0]);
  });
}

// ─── Button wiring ─────────────────────────────────────────────────────────────

function setupButtons() {
  el("generateLessonBtn")?.addEventListener("click", generateLesson);
  el("backToUploadBtn")?.addEventListener("click",   () => showSection("uploadSection"));
  el("makeQuizBtn")?.addEventListener("click",       generateQuiz);
  el("backToLessonBtn")?.addEventListener("click",   () => showSection("lessonSection"));
  el("quizNextBtn")?.addEventListener("click",       nextQuestion);
  el("quizFinishBtn")?.addEventListener("click",     generateReport);
  el("retakeQuizBtn")?.addEventListener("click",     startQuiz);
  el("newLessonBtn")?.addEventListener("click",      () => showSection("uploadSection"));
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Generate Lesson
// ══════════════════════════════════════════════════════════════════════════════

async function generateLesson() {
  const file      = el("lessonFileInput").files[0];
  const statusEl  = el("lessonUploadStatus");
  const btn       = el("generateLessonBtn");

  if (!file) {
    statusEl.textContent = "Choose a file first.";
    showToast("Choose a file first.", "info");
    return;
  }

  btn.disabled    = true;
  statusEl.textContent = "";

  showLoadingOverlay({
    title:   "Building your lesson...",
    message: "Reading document.",
    steps:   ["Reading document", "Analyzing content", "Structuring lesson", "Writing summary", "Done"]
  });

  try {
    const form = new FormData();
    form.append("document", file);

    updateLoadingOverlay("Extracting text...", 20);

    const res = await fetch("/api/lessons/generate", { method: "POST", body: form });

    updateLoadingOverlay("Structuring lesson...", 70);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate lesson.");

    lesson       = data.lesson;
    documentText = data.documentText;

    updateLoadingOverlay("Done!", 100);

    renderLesson(lesson);
    showSection("lessonSection");
    showToast("Lesson ready!", "success");
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message;
    showToast(err.message || "Something went wrong.", "danger");
  } finally {
    hideLoadingOverlay();
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Render Lesson
// ══════════════════════════════════════════════════════════════════════════════

function renderLesson(l) {
  el("lessonTitle").textContent = l.title || "Lesson";
  el("lessonSummary").textContent = l.summary || "";

  // Objectives
  el("lessonObjectives").innerHTML = (l.objectives || []).map(o => `
    <li style="display:flex;gap:10px;align-items:flex-start;">
      <span style="color:var(--green);font-weight:900;flex-shrink:0;margin-top:2px;">✓</span>
      <span>${escapeHTML(o)}</span>
    </li>`).join("");

  // Key concepts
  el("lessonKeyConcepts").innerHTML = (l.keyConcepts || []).map(c =>
    `<span class="pill">${escapeHTML(c)}</span>`
  ).join("");

  // Sections
  el("lessonSectionsContainer").innerHTML = (l.sections || []).map(s => `
    <div class="card">
      <div class="eyebrow">${escapeHTML(s.title)}</div>
      <p style="margin-top:14px;line-height:1.8;">${escapeHTML(s.content)}</p>
      ${s.keyPoints?.length ? `
        <div style="margin-top:18px;">
          <strong style="font-size:13px;letter-spacing:.04em;">Key Points</strong>
          <ul style="margin-top:10px;display:grid;gap:7px;list-style:none;padding:0;">
            ${s.keyPoints.map(p => `
              <li style="display:flex;gap:8px;align-items:flex-start;">
                <span style="color:var(--blue);flex-shrink:0;font-weight:900;">→</span>
                <span>${escapeHTML(p)}</span>
              </li>`).join("")}
          </ul>
        </div>` : ""}
    </div>`).join("");

  // Memory tips
  el("lessonMemoryTips").innerHTML = (l.memoryTips || []).map(t => `
    <li style="display:flex;gap:10px;align-items:flex-start;">
      <span style="flex-shrink:0;">💡</span>
      <span>${escapeHTML(t)}</span>
    </li>`).join("");
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Generate Quiz
// ══════════════════════════════════════════════════════════════════════════════

async function generateQuiz() {
  const statusEl = el("quizGenStatus");
  const btn      = el("makeQuizBtn");

  btn.disabled    = true;
  btn.textContent = "Generating quiz...";
  statusEl.textContent = "";

  try {
    const res = await fetch("/api/lessons/quiz", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ lesson, documentText })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate quiz.");

    quiz = data;
    startQuiz();
    showSection("quizSection");
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message;
    showToast(err.message || "Could not generate quiz.", "danger");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Make Quiz";
  }
}

function startQuiz() {
  questionIdx = 0;
  score       = 0;
  userAnswers = new Array(quiz.questions.length).fill(null);
  el("quizHeading").textContent = lesson?.title || "Quiz";
  renderQuestion();
}

function renderQuestion() {
  const questions = quiz.questions;
  const q         = questions[questionIdx];
  const total     = questions.length;

  // Progress
  el("quizProgressLabel").textContent = `Question ${questionIdx + 1} of ${total}`;
  el("quizScorePill").textContent     = `${score} / ${total}`;
  el("quizProgressBar").style.width   = `${Math.round((questionIdx / total) * 100)}%`;

  // Tags
  el("quizDifficultyTag").textContent = q.difficulty || "medium";
  el("quizConceptTag").textContent    = q.concept    || "";

  // Question text
  el("quizQuestionText").textContent = q.question;

  // Options
  const box = el("quizOptionsBox");
  box.innerHTML = "";
  (q.options || []).forEach(opt => {
    const btn = document.createElement("button");
    btn.type      = "button";
    btn.className = "option";
    btn.textContent = opt;
    btn.addEventListener("click", () => answerQuestion(opt));
    box.appendChild(btn);
  });

  // Reset feedback & nav
  el("quizFeedbackBox").classList.add("hidden");
  el("quizNextBtn").classList.add("hidden");
  el("quizFinishBtn").classList.add("hidden");
}

function answerQuestion(selected) {
  const q         = quiz.questions[questionIdx];
  const isCorrect = selected === q.correctAnswer;

  userAnswers[questionIdx] = selected;
  if (isCorrect) score++;

  el("quizScorePill").textContent = `${score} / ${quiz.questions.length}`;

  // Lock and colour options
  el("quizOptionsBox").querySelectorAll(".option").forEach(btn => {
    btn.disabled = true;
    const text = btn.textContent;
    if (text === q.correctAnswer) {
      Object.assign(btn.style, { background: "var(--green)", color: "white", borderColor: "var(--green)", opacity: "1" });
    } else if (text === selected && !isCorrect) {
      Object.assign(btn.style, { background: "var(--red)", color: "white", borderColor: "var(--red)", opacity: "1" });
    } else {
      btn.style.opacity = "0.4";
    }
  });

  // Feedback
  const feedbackTitle = el("quizFeedbackTitle");
  feedbackTitle.textContent = isCorrect ? "✅ Correct!" : `❌ Incorrect — correct: "${q.correctAnswer}"`;
  feedbackTitle.style.color = isCorrect ? "var(--green)" : "var(--red)";
  el("quizFeedbackExplanation").textContent = q.explanation || "";
  el("quizFeedbackBox").classList.remove("hidden");

  // Nav button
  const isLast = questionIdx >= quiz.questions.length - 1;
  el(isLast ? "quizFinishBtn" : "quizNextBtn").classList.remove("hidden");
}

function nextQuestion() {
  questionIdx++;
  renderQuestion();
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Generate Report
// ══════════════════════════════════════════════════════════════════════════════

async function generateReport() {
  const btn = el("quizFinishBtn");
  btn.disabled    = true;
  btn.textContent = "Generating report...";

  try {
    const res = await fetch("/api/lessons/report", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ lesson, questions: quiz.questions, userAnswers })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate report.");

    renderReport(data);
    showSection("reportSection");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not generate report.", "danger");
  } finally {
    btn.disabled    = false;
    btn.textContent = "See My Report";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Render Report
// ══════════════════════════════════════════════════════════════════════════════

function renderReport(report) {
  const pct = report.percentage;

  // Score
  const scoreColor = pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--orange)" : "var(--red)";
  el("reportScoreDisplay").textContent = `${pct}%`;
  el("reportScoreDisplay").style.color = scoreColor;
  el("reportScoreLabel").textContent   = `${report.score} out of ${report.total} correct`;
  el("reportOverallFeedback").textContent = report.analysis?.overallFeedback || "";

  // Strengths
  el("reportStrengths").innerHTML = (report.analysis?.strengths || []).map(s => `
    <div style="display:flex;gap:10px;align-items:flex-start;">
      <span style="color:var(--green);font-weight:900;flex-shrink:0;">✓</span>
      <span>${escapeHTML(s)}</span>
    </div>`).join("") || `<p class="muted">Keep studying!</p>`;

  // Mastered concepts
  const mastered = report.analysis?.masteredConcepts || [];
  el("reportMastered").innerHTML = mastered.length
    ? mastered.map(c => `<span class="pill" style="background:var(--green);color:white;">${escapeHTML(c)}</span>`).join("")
    : `<span class="muted">No concepts fully mastered yet — keep going!</span>`;

  // Gap analysis
  const gaps = report.analysis?.gapAnalysis || [];
  el("reportGaps").innerHTML = gaps.length === 0
    ? `<p class="muted">No significant gaps! Excellent work.</p>`
    : gaps.map(g => `
        <div class="flat-card" style="border-left:5px solid var(--red);padding-left:18px;">
          <strong style="font-size:16px;">${escapeHTML(g.concept)}</strong>
          <p class="muted" style="margin-top:6px;">${escapeHTML(g.issue)}</p>
          <div style="margin-top:12px;">
            <span class="eyebrow" style="font-size:10px;">Recommendation</span>
            <p style="margin-top:6px;line-height:1.7;">${escapeHTML(g.recommendation)}</p>
          </div>
          ${g.lessonSection ? `
            <div style="margin-top:10px;">
              <span class="pill" style="font-size:12px;">📖 Re-read: ${escapeHTML(g.lessonSection)}</span>
            </div>` : ""}
        </div>`).join("");

  // Study plan
  el("reportStudyPlan").innerHTML = (report.analysis?.studyPlan || []).map((step, i) => `
    <li style="display:flex;gap:12px;align-items:flex-start;">
      <span style="background:var(--blue);color:white;border-radius:50%;width:26px;height:26px;
                   display:grid;place-items:center;flex-shrink:0;font-size:12px;font-weight:900;">
        ${i + 1}
      </span>
      <span style="line-height:1.7;">${escapeHTML(step)}</span>
    </li>`).join("");
}

init();
