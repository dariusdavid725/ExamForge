import { installFeedback, showToast, showLoadingOverlay, updateLoadingOverlay, hideLoadingOverlay } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { state } from "../shared/state.js";
import { saveLessonToStorage, getLessonsFromStorage, updateLessonProgress, deleteLessonFromStorage } from "../shared/lessonStorage.js";
import {
  renderChallenge,
  renderResultPhase
} from "../components/renderer.js";

// ─── Page state ────────────────────────────────────────────────────────────────

let lesson         = null;
let documentText   = null;
let quiz           = null;
let userAnswers    = [];
let lessonScore    = 0;
let lessonSource   = "upload";
let currentLessonId = null;   // id of the open lesson entry in localStorage

// ─── Helpers ───────────────────────────────────────────────────────────────────

const el = id => document.getElementById(id);

function escapeHTML(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showSection(id) {
  ["myLessonsSection", "uploadSection", "lessonSection", "quizSection", "reportSection"].forEach(s =>
    el(s)?.classList.toggle("hidden", s !== id)
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function scoreColor(pct) {
  if (pct === null || pct === undefined) return "var(--muted)";
  if (pct === 100) return "var(--green)";
  if (pct >= 90)  return "var(--blue)";
  if (pct >= 60)  return "var(--orange)";
  return "var(--red)";
}

function statusInfo(entry) {
  const s = entry.lastQuizScore;
  if (s === null || s === undefined) return { label: "Not started",     btnText: "Start Learning",    primary: true  };
  if (s === 100)                      return { label: "Completed 🏆",    btnText: "Revisit",           primary: false };
  if (s >= 90)                        return { label: "Almost there!",   btnText: "Try Again",         primary: false };
  if (s >= 60)                        return { label: "Keep practicing", btnText: "Keep Practicing",   primary: true  };
  return                                     { label: "Needs review",    btnText: "Review Now",        primary: true  };
}

// ─── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  installFeedback();
  installThemeToggle();

  const auth = await initHeader();
  if (!auth) {
    showToast("Sign in to access lessons.", "info");
    setTimeout(nav.login, 1200);
    return;
  }

  setupUpload();
  setupButtons();

  const saved = getLessonsFromStorage();
  if (saved.length > 0) {
    showMyLessons();
  } else {
    showSection("uploadSection");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MY LESSONS VIEW
// ══════════════════════════════════════════════════════════════════════════════

function showMyLessons() {
  renderMyLessons();
  showSection("myLessonsSection");
}

function renderMyLessons() {
  const lessons = getLessonsFromStorage();
  const grid    = el("lessonCardsGrid");
  if (!grid) return;

  if (!lessons.length) {
    grid.innerHTML = `<div class="flat-card" style="text-align:center;padding:32px;">
      <p class="muted">No lessons yet.</p>
      <button id="firstLessonBtn" class="btn" style="margin-top:16px;">Create your first lesson</button>
    </div>`;
    el("firstLessonBtn")?.addEventListener("click", () => showSection("uploadSection"));
    return;
  }

  grid.innerHTML = lessons.map(entry => {
    const { label, btnText, primary } = statusInfo(entry);
    const score   = entry.lastQuizScore;
    const hasPct  = score !== null && score !== undefined;
    const color   = scoreColor(score);
    const date    = new Date(entry.createdAt).toLocaleDateString();

    const reviewHtml = (entry.reviewTopics?.length && score !== 100 && score !== null)
      ? `<div style="margin-top:14px;">
           <div class="eyebrow" style="font-size:10px;margin-bottom:8px;">Topics to review</div>
           <div class="row" style="flex-wrap:wrap;gap:6px;">
             ${entry.reviewTopics.map(t => `<span class="pill" style="font-size:12px;border-color:var(--red);">${escapeHTML(t)}</span>`).join("")}
           </div>
         </div>`
      : "";

    return `
      <div class="card lesson-progress-card" style="display:flex;flex-direction:column;gap:0;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="min-width:0;">
            <div class="eyebrow" style="font-size:10px;">${escapeHTML(entry.language)} · ${date}</div>
            <h3 style="margin-top:8px;font-size:18px;line-height:1.3;">${escapeHTML(entry.title)}</h3>
          </div>
          <span style="flex-shrink:0;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:900;
                       background:${color};color:${score === null ? "var(--text)" : "white"};
                       border:2px solid ${color};">
            ${escapeHTML(label)}
          </span>
        </div>

        <!-- Progress bar -->
        <div style="margin-top:16px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:900;margin-bottom:6px;">
            <span>Quiz score</span>
            <span>${hasPct ? score + "%" : "—"}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${hasPct ? score : 0}%;background:${color};transition:width .6s ease;"></div>
          </div>
        </div>

        ${reviewHtml}

        <!-- Actions -->
        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">
          <button class="btn${primary ? "" : " btn-secondary"}" data-open="${escapeHTML(entry.id)}"
                  style="flex:1;">
            ${escapeHTML(btnText)}
          </button>
          <button class="btn btn-secondary" data-delete="${escapeHTML(entry.id)}"
                  style="padding:10px 14px;" title="Delete lesson">🗑</button>
        </div>
      </div>`;
  }).join("");

  // Event delegation
  grid.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => openLessonFromStorage(btn.dataset.open));
  });

  grid.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      deleteLessonFromStorage(btn.dataset.delete);
      renderMyLessons();
      if (!getLessonsFromStorage().length) showSection("uploadSection");
    });
  });
}

function openLessonFromStorage(id) {
  const entry = getLessonsFromStorage().find(l => l.id === id);
  if (!entry) return;

  currentLessonId = entry.id;
  lesson          = entry.lesson;
  documentText    = entry.documentText;
  quiz            = null;

  renderLesson(lesson);
  showSection("lessonSection");
}

// ─── File upload ───────────────────────────────────────────────────────────────

function setupUpload() {
  el("lessonTabUpload")?.addEventListener("click", () => switchLessonSource("upload"));
  el("lessonTabTopic")?.addEventListener("click",  () => switchLessonSource("topic"));

  const dropZone  = el("lessonDropZone");
  const fileInput = el("lessonFileInput");
  const nameLbl   = el("lessonFileName");
  const pick = f => { nameLbl.textContent = f.name; };

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

function switchLessonSource(source) {
  lessonSource = source;
  el("lessonTabUpload")?.classList.toggle("auth-tab-active", source === "upload");
  el("lessonTabTopic")?.classList.toggle("auth-tab-active",  source === "topic");
  el("lessonUploadPanel")?.classList.toggle("hidden", source === "topic");
  el("lessonTopicPanel")?.classList.toggle("hidden",  source === "upload");
}

// ─── Button wiring ─────────────────────────────────────────────────────────────

function setupButtons() {
  el("generateLessonBtn")?.addEventListener("click",          generateLesson);
  el("newLessonFromGridBtn")?.addEventListener("click",       () => showSection("uploadSection"));
  el("backToMyLessonsBtn")?.addEventListener("click",         showMyLessons);
  el("backToMyLessonsFromLesson")?.addEventListener("click",  showMyLessons);
  el("backToMyLessonsFromReport")?.addEventListener("click",  () => { showMyLessons(); });
  el("makeQuizBtn")?.addEventListener("click",                generateQuiz);
  el("backToLessonBtn")?.addEventListener("click",            () => showSection("lessonSection"));
  el("submitAnswerBtn")?.addEventListener("click",            submitLessonAnswer);
  el("quizNextBtn")?.addEventListener("click",                nextQuestion);
  el("quizFinishBtn")?.addEventListener("click",              generateReport);
  el("retakeQuizBtn")?.addEventListener("click",              startQuiz);
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Generate Lesson
// ══════════════════════════════════════════════════════════════════════════════

async function generateLesson() {
  const statusEl = el("lessonUploadStatus");
  const btn      = el("generateLessonBtn");
  statusEl.textContent = "";

  let form;
  if (lessonSource === "topic") {
    const topic = el("lessonTopicInput")?.value.trim();
    if (!topic) { statusEl.textContent = "Write a topic first."; showToast("Write a topic first.", "info"); return; }
    form = new FormData();
    form.append("topic", topic);
  } else {
    const file = el("lessonFileInput").files[0];
    if (!file) { statusEl.textContent = "Choose a file first."; showToast("Choose a file first.", "info"); return; }
    form = new FormData();
    form.append("document", file);
  }

  btn.disabled = true;

  showLoadingOverlay({
    title:   "Building your lesson...",
    message: lessonSource === "topic" ? "Researching topic." : "Reading document.",
    steps:   ["Analyzing content", "Structuring lesson", "Writing sections", "Adding key points", "Done"]
  });

  try {
    updateLoadingOverlay("Structuring lesson...", 40);
    const res  = await fetch("/api/lessons/generate", { method: "POST", body: form });
    updateLoadingOverlay("Writing sections...", 75);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate lesson.");

    lesson       = data.lesson;
    documentText = data.documentText;

    const entry = saveLessonToStorage(lesson, documentText);
    currentLessonId = entry.id;

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
  el("lessonTitle").textContent   = l.title   || "Lesson";
  el("lessonSummary").textContent = l.summary || "";

  el("lessonObjectives").innerHTML = (l.objectives || []).map(o => `
    <li style="display:flex;gap:10px;align-items:flex-start;">
      <span style="color:var(--green);font-weight:900;flex-shrink:0;margin-top:2px;">✓</span>
      <span>${escapeHTML(o)}</span>
    </li>`).join("");

  el("lessonKeyConcepts").innerHTML = (l.keyConcepts || [])
    .map(c => `<span class="pill">${escapeHTML(c)}</span>`).join("");

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
  btn.disabled = true; btn.textContent = "Generating..."; statusEl.textContent = "";

  showLoadingOverlay({
    title:   "Creating your quiz...",
    message: "Analysing lesson content.",
    steps:   ["Reading lesson", "Generating questions", "Balancing difficulty", "Preparing quiz"]
  });

  try {
    updateLoadingOverlay("Generating questions...", 40);
    const res  = await fetch("/api/lessons/quiz", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson, documentText })
    });
    updateLoadingOverlay("Preparing quiz...", 85);
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
    hideLoadingOverlay();
    btn.disabled = false; btn.textContent = "Make Quiz";
  }
}

// ── Quiz engine ────────────────────────────────────────────────────────────────

function convertToChallenge(q) {
  return {
    type: "multiple_choice", concept: q.concept || "Concept", difficulty: q.difficulty || "medium",
    prompt: q.question, options: q.options, correctAnswer: q.correctAnswer,
    correctAnswers: [], pairs: [], acceptedAnswers: [], steps: [], correctOrder: [],
    mistakeText: "", explanation: q.explanation || "", sourceSnippet: ""
  };
}

function startQuiz() {
  state.currentPack = { challenges: quiz.questions.map(convertToChallenge) };
  state.currentChallengeIndex = 0;
  state.localScore            = 0;
  state.selectedAnswer        = null;
  state.currentOrderSelection = [];
  userAnswers = new Array(quiz.questions.length).fill(null);
  lessonScore = 0;

  el("quizHeading").textContent = lesson?.title || "Quiz";
  el("scoreText").textContent   = 0;
  hideNavButtons();
  renderChallenge(submitLessonAnswer);
}

function submitLessonAnswer() {
  if (state.selectedAnswer === null) return;

  const challenge = state.currentPack.challenges[state.currentChallengeIndex];
  const isCorrect = state.selectedAnswer === challenge.correctAnswer;

  userAnswers[state.currentChallengeIndex] = state.selectedAnswer;
  if (isCorrect) { lessonScore++; state.localScore++; }

  el("scoreText").textContent = lessonScore;
  renderResultPhase(challenge, { isCorrect, isPartial: false, points: isCorrect ? 100 : 0 });

  const isLast = state.currentChallengeIndex >= state.currentPack.challenges.length - 1;
  el(isLast ? "quizFinishBtn" : "quizNextBtn").classList.remove("hidden");
}

function nextQuestion() {
  state.currentChallengeIndex++;
  state.selectedAnswer        = null;
  state.currentOrderSelection = [];
  hideNavButtons();
  renderChallenge(submitLessonAnswer);
}

function hideNavButtons() {
  el("quizNextBtn").classList.add("hidden");
  el("quizFinishBtn").classList.add("hidden");
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Generate Report
// ══════════════════════════════════════════════════════════════════════════════

async function generateReport() {
  const btn = el("quizFinishBtn");
  btn.disabled = true; btn.textContent = "Generating...";

  showLoadingOverlay({
    title:   "Analysing your results...",
    message: "Evaluating your answers.",
    steps:   ["Evaluating answers", "Identifying gaps", "Writing recommendations", "Preparing report"]
  });

  try {
    updateLoadingOverlay("Identifying gaps...", 50);
    const res  = await fetch("/api/lessons/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson, questions: quiz.questions, userAnswers })
    });
    updateLoadingOverlay("Preparing report...", 85);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate report.");

    // ── Save progress to localStorage ──────────────────────────────────────
    if (currentLessonId) {
      const reviewTopics = (data.analysis?.gapAnalysis || []).map(g => g.concept).filter(Boolean);
      updateLessonProgress(currentLessonId, { percentage: data.percentage, reviewTopics });
    }

    renderReport(data);
    showSection("reportSection");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not generate report.", "danger");
  } finally {
    hideLoadingOverlay();
    btn.disabled = false; btn.textContent = "See My Report →";
  }
}

// ── Report renderer ────────────────────────────────────────────────────────────

function renderReport(report) {
  const pct = report.percentage;
  const col = pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--orange)" : "var(--red)";

  el("reportScoreDisplay").textContent = `${pct}%`;
  el("reportScoreDisplay").style.color = col;
  el("reportScoreLabel").textContent   = `${report.score} out of ${report.total} correct`;
  el("reportOverallFeedback").textContent = report.analysis?.overallFeedback || "";

  el("reportStrengths").innerHTML = (report.analysis?.strengths || []).map(s => `
    <div style="display:flex;gap:10px;align-items:flex-start;">
      <span style="color:var(--green);font-weight:900;flex-shrink:0;">✓</span>
      <span>${escapeHTML(s)}</span>
    </div>`).join("") || `<p class="muted">Keep studying!</p>`;

  const mastered = report.analysis?.masteredConcepts || [];
  el("reportMastered").innerHTML = mastered.length
    ? mastered.map(c => `<span class="pill" style="background:var(--green);color:white;">${escapeHTML(c)}</span>`).join("")
    : `<span class="muted">No concepts fully mastered yet — keep going!</span>`;

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
          ${g.lessonSection ? `<div style="margin-top:10px;"><span class="pill" style="font-size:12px;">📖 Re-read: ${escapeHTML(g.lessonSection)}</span></div>` : ""}
        </div>`).join("");

  el("reportStudyPlan").innerHTML = (report.analysis?.studyPlan || []).map((step, i) => `
    <li style="display:flex;gap:12px;align-items:flex-start;">
      <span style="background:var(--blue);color:white;border-radius:50%;width:26px;height:26px;
                   display:grid;place-items:center;flex-shrink:0;font-size:12px;font-weight:900;">${i + 1}</span>
      <span style="line-height:1.7;">${escapeHTML(step)}</span>
    </li>`).join("");
}

init();
