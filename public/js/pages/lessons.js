import { installFeedback, showToast, showLoadingOverlay, updateLoadingOverlay, hideLoadingOverlay } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { state } from "../shared/state.js";
import { saveLessonToStorage, getLessonsFromStorage, updateLessonProgress, deleteLessonFromStorage } from "../shared/lessonStorage.js";
import {
  renderChallenge,
  renderResultPhase
} from "../components/renderer.js";
import {
  processIntoLearningPath,
  getLearningPath,
  renderLearningPath,
  showProcessingModal,
  updateProcessingStep,
  closeProcessingModal
} from "../features/learningPath.js";

// ─── Page state ────────────────────────────────────────────────────────────────

let lesson          = null;
let documentText    = null;
let quiz            = null;
let userAnswers     = [];
let lessonScore     = 0;
let lessonSource    = "upload";
let currentLessonId = null;
let currentUser     = null;
let userPlan        = "free";
let weeklyUsage     = { lessons: 0, quizzes: 0 };
let cachedLessons   = [];   // in-memory cache to avoid re-fetching on every open

// ─── Helpers ───────────────────────────────────────────────────────────────────

const el = id => document.getElementById(id);

function escapeHTML(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showSection(id) {
  ["myLessonsSection", "uploadSection", "lessonSection", "quizSection", "reportSection", "learningPathSection"].forEach(s =>
    el(s)?.classList.toggle("hidden", s !== id)
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "uploadSection") updateUsageBanner();
  if (id === "lessonSection") updateQuizBtnForPlan();
  if (id === "learningPathSection") loadLearningPath();
}

function showUpgradeModal(message) {
  const existing = document.getElementById("upgradeModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "upgradeModal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;`;
  modal.innerHTML = `
    <div class="card" style="max-width:440px;width:100%;text-align:center;position:relative;">
      <div style="font-size:48px;margin-bottom:12px;">⭐</div>
      <h2 style="margin:0 0 12px;">Functie Premium</h2>
      <p class="muted" style="margin-bottom:24px;">${escapeHTML(message)}</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="/pricing" class="btn" style="padding:12px 28px;">Upgrade &mdash; €5/luna</a>
        <button id="upgradeModalClose" class="btn btn-secondary" style="padding:12px 20px;">Mai tarziu</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#upgradeModalClose").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
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

  currentUser = auth.user;
  await loadPlanStatus();

  setupUpload();
  setupButtons();
  updateQuizBtnForPlan();

  cachedLessons = await getLessonsFromStorage(currentUser.id);
  if (cachedLessons.length > 0) {
    showMyLessons();
  } else {
    showSection("uploadSection");
  }
}

async function loadPlanStatus() {
  if (!currentUser) return;
  try {
    const res  = await fetch(`/api/stripe/plan-status?userId=${currentUser.id}`);
    const data = await res.json();
    if (res.ok) {
      userPlan    = data.plan;
      weeklyUsage = { lessons: data.weeklyLessonsUsed, quizzes: data.weeklyQuizzesUsed };
    }
  } catch { /* silent */ }
}

function updateUsageBanner() {
  const banner = el("usageBanner");
  if (!banner) return;
  if (userPlan === "premium") {
    banner.style.display = "none";
    return;
  }
  const left = Math.max(0, 3 - weeklyUsage.lessons);
  banner.style.display = "";
  banner.innerHTML = `
    <div class="flat-card" style="background:${left === 0 ? "var(--red)" : "var(--yellow)"};
         border-color:var(--text);margin-bottom:20px;display:flex;align-items:center;
         justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <span style="font-weight:900;">
        ${left === 0
          ? "Ai atins limita de 3 lectii pe saptamana."
          : `${weeklyUsage.lessons}/3 lectii folosite saptamana aceasta.`}
      </span>
      <a href="/pricing" class="btn" style="padding:8px 18px;font-size:14px;">Upgrade Premium</a>
    </div>`;
}

function updateQuizBtnForPlan() {
  const btn = el("makeQuizBtn");
  if (!btn) return;
  if (userPlan === "premium") {
    btn.textContent = "Make Quiz";
    btn.classList.remove("btn-secondary");
  } else {
    btn.innerHTML = "Make Quiz <span style='font-size:14px;'>&#128274; Premium</span>";
    btn.classList.add("btn-secondary");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MY LESSONS VIEW
// ══════════════════════════════════════════════════════════════════════════════

async function showMyLessons() {
  await renderMyLessons();
  showSection("myLessonsSection");
}

async function renderMyLessons() {
  cachedLessons = await getLessonsFromStorage(currentUser?.id);
  const grid    = el("lessonCardsGrid");
  if (!grid) return;

  if (!cachedLessons.length) {
    grid.innerHTML = `<div class="flat-card" style="text-align:center;padding:32px;">
      <p class="muted">No lessons yet.</p>
      <button id="firstLessonBtn" class="btn" style="margin-top:16px;">Create your first lesson</button>
    </div>`;
    el("firstLessonBtn")?.addEventListener("click", () => showSection("uploadSection"));
    return;
  }

  grid.innerHTML = cachedLessons.map(entry => {
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
    btn.addEventListener("click", () => openLesson(btn.dataset.open));
  });

  grid.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteLessonFromStorage(btn.dataset.delete, currentUser?.id);
      await renderMyLessons();
      if (!cachedLessons.length) showSection("uploadSection");
    });
  });
}

function openLesson(id) {
  const entry = cachedLessons.find(l => l.id === id);
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
  el("smartProcessBtn")?.addEventListener("click",            handleSmartProcess);
  el("newLessonFromGridBtn")?.addEventListener("click",       () => showSection("uploadSection"));
  el("backToMyLessonsBtn")?.addEventListener("click",         showMyLessons);
  el("backToMyLessonsFromLesson")?.addEventListener("click",  showMyLessons);
  el("backToMyLessonsFromReport")?.addEventListener("click",  showMyLessons);
  el("backToMyLessonsFromPath")?.addEventListener("click",    showMyLessons);
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

  // Re-fetch plan status to ensure freshness, then check BEFORE loading
  await loadPlanStatus();
  if (userPlan === "free" && weeklyUsage.lessons >= 3) {
    showUpgradeModal("Ai atins limita de 3 lectii pe saptamana. Upgradeaza la Premium pentru lectii nelimitate.");
    return;
  }

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
  if (currentUser?.id) form.append("userId", currentUser.id);

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
    if (!res.ok) {
      if (data.limitReached) {
        showUpgradeModal("Ai atins limita de 3 lectii pe saptamana. Upgradeaza la Premium pentru lectii nelimitate.");
        return;
      }
      throw new Error(data.error || "Could not generate lesson.");
    }
    weeklyUsage.lessons = Math.min(3, weeklyUsage.lessons + 1);
    updateUsageBanner();

    lesson       = data.lesson;
    documentText = data.documentText;

    const entry = await saveLessonToStorage(lesson, documentText, currentUser?.id);
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
      <p style="margin-top:14px;line-height:1.8;font-size:16px;">${escapeHTML(s.content)}</p>
      
      ${s.example ? `
        <div style="margin-top:20px;padding:18px;background:var(--bg-light);border-left:4px solid var(--blue);border-radius:8px;">
          <strong style="font-size:13px;letter-spacing:.04em;color:var(--blue);">💡 Example</strong>
          <p style="margin-top:10px;line-height:1.7;color:var(--text);">${escapeHTML(s.example)}</p>
        </div>` : ""}
      
      ${s.keyPoints?.length ? `
        <div style="margin-top:20px;">
          <strong style="font-size:13px;letter-spacing:.04em;">Key Takeaways</strong>
          <ul style="margin-top:12px;display:grid;gap:10px;list-style:none;padding:0;">
            ${s.keyPoints.map(p => `
              <li style="display:flex;gap:10px;align-items:flex-start;">
                <span style="color:var(--green);flex-shrink:0;font-weight:900;font-size:18px;">✓</span>
                <span style="line-height:1.6;">${escapeHTML(p)}</span>
              </li>`).join("")}
          </ul>
        </div>` : ""}
      
      ${s.commonMisconception ? `
        <div style="margin-top:20px;padding:16px;background:#fff4c7;border-left:4px solid var(--orange);border-radius:8px;">
          <strong style="font-size:13px;letter-spacing:.04em;color:var(--orange);">⚠️ Common Misconception</strong>
          <p style="margin-top:10px;line-height:1.7;color:var(--text);">${escapeHTML(s.commonMisconception)}</p>
        </div>` : ""}
    </div>`).join("");

  el("lessonMemoryTips").innerHTML = (l.memoryTips || []).map(t => `
    <li style="display:flex;gap:10px;align-items:flex-start;">
      <span style="flex-shrink:0;">💡</span>
      <span style="line-height:1.6;">${escapeHTML(t)}</span>
    </li>`).join("");

  const selfCheckSection = el("selfCheckSection");
  const selfCheckList    = el("lessonSelfCheck");
  if (l.selfCheckQuestions?.length) {
    selfCheckSection.style.display = "";
    selfCheckList.innerHTML = l.selfCheckQuestions.map(q => `
      <li style="display:flex;gap:12px;align-items:flex-start;padding:14px;background:var(--bg-light);border-radius:8px;">
        <span style="flex-shrink:0;font-size:20px;">🤔</span>
        <span style="line-height:1.7;font-weight:600;">${escapeHTML(q)}</span>
      </li>`).join("");
  } else {
    selfCheckSection.style.display = "none";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Generate Quiz
// ══════════════════════════════════════════════════════════════════════════════

async function generateQuiz() {
  if (userPlan !== "premium") {
    showUpgradeModal("Quiz-urile la lectii sunt disponibile doar in planul Premium.");
    return;
  }

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
      body: JSON.stringify({ lesson, documentText, userId: currentUser?.id })
    });
    updateLoadingOverlay("Preparing quiz...", 85);
    const data = await res.json();
    if (!res.ok) {
      if (data.premiumRequired) {
        showUpgradeModal(data.error || "Functie Premium.");
        return;
      }
      throw new Error(data.error || "Could not generate quiz.");
    }

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
      body: JSON.stringify({ lesson, questions: quiz.questions, userAnswers, userId: currentUser?.id })
    });
    updateLoadingOverlay("Preparing report...", 85);
    const data = await res.json();
    if (!res.ok) {
      if (data.premiumRequired) {
        showUpgradeModal(data.error || "Functie Premium.");
        return;
      }
      throw new Error(data.error || "Could not generate report.");
    }

    if (currentLessonId && currentUser?.id) {
      const reviewTopics = (data.analysis?.gapAnalysis || []).map(g => g.concept).filter(Boolean);
      await updateLessonProgress(currentLessonId, currentUser.id, { percentage: data.percentage, reviewTopics });

      // Update cache so the card shows the new score immediately on back
      const idx = cachedLessons.findIndex(l => l.id === currentLessonId);
      if (idx !== -1) {
        cachedLessons[idx] = {
          ...cachedLessons[idx],
          lastQuizScore: data.percentage,
          lastQuizDate:  new Date().toISOString(),
          reviewTopics:  reviewTopics.slice(0, 8)
        };
      }
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

// ─── Learning Path ─────────────────────────────────────────────────────────────

async function handleSmartProcess() {
  const statusEl = el("lessonUploadStatus");
  statusEl.textContent = "";

  // Check plan limits
  await loadPlanStatus();
  if (userPlan === "free" && weeklyUsage.lessons >= 3) {
    showUpgradeModal("You've reached the free plan limit of 3 lessons per week. Upgrade to Premium for unlimited lessons and Smart Learning Paths!");
    return;
  }

  // Get document text from file or topic
  let textToProcess = documentText;
  let docName = "Document";

  if (!textToProcess || textToProcess.length < 100) {
    // Try to extract from current upload/topic
    if (lessonSource === "topic") {
      const topic = el("lessonTopicInput")?.value.trim();
      if (!topic) {
        statusEl.textContent = "Write a topic first.";
        showToast("Write a topic first.", "info");
        return;
      }
      // For topic, we need to generate text first
      showToast("Please generate lesson first, then use Smart Learning Path.", "info");
      return;
    } else {
      const file = el("lessonFileInput").files[0];
      if (!file) {
        statusEl.textContent = "Choose a file first.";
        showToast("Choose a file first.", "info");
        return;
      }

      // Extract text from file
      try {
        const modal = showProcessingModal();
        updateProcessingStep("Reading document...");

        const form = new FormData();
        form.append("document", file);
        if (currentUser?.id) form.append("userId", currentUser.id);

        const res = await fetch("/api/lessons/generate", { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Could not read document.");
        }

        textToProcess = data.documentText;
        docName = file.name;
        documentText = textToProcess; // Cache it

        closeProcessingModal();

      } catch (error) {
        console.error("Error reading document:", error);
        closeProcessingModal();
        showToast("Failed to read document. Please try again.", "error");
        return;
      }
    }
  }

  try {
    const modal = showProcessingModal();
    
    updateProcessingStep("Analyzing content structure...");
    
    const result = await processIntoLearningPath(
      currentUser.id,
      docName,
      textToProcess
    );

    updateProcessingStep(`Created ${result.units.length} learning units`);
    updateProcessingStep(`Extracted ${result.conceptsCount} key concepts`);
    updateProcessingStep(`Mapped ${result.dependenciesCount} concept relationships`);

    weeklyUsage.lessons = Math.min(3, weeklyUsage.lessons + 1);
    updateUsageBanner();

    closeProcessingModal();
    
    showToast(`🎉 Smart Learning Path created with ${result.units.length} units!`, "success");
    
    // Wait a moment for DB to finish, then navigate
    setTimeout(() => {
      showSection("learningPathSection");
    }, 500);

  } catch (error) {
    console.error("Smart processing error:", error);
    closeProcessingModal();
    showToast("Failed to create learning path. Please try again.", "error");
  }
}

async function loadLearningPath() {
  if (!currentUser) return;

  const container = el("learningPathContainer");
  if (!container) return;

  container.innerHTML = '<div class="card" style="text-align:center;padding:32px;"><div class="spinner"></div><p class="muted" style="margin-top:12px;">Loading learning path...</p></div>';

  try {
    const pathData = await getLearningPath(currentUser.id);
    console.log("Learning path data:", pathData); // Debug
    renderLearningPath(container, pathData, currentUser.id);
  } catch (error) {
    console.error("Error loading learning path:", error);
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:32px;">
        <p style="font-size:14px;margin-bottom:8px;">❌ Failed to load learning path</p>
        <p class="muted" style="font-size:12px;">${error.message || 'Please try again.'}</p>
        <button onclick="window.location.reload()" class="btn btn-secondary" style="margin-top:16px;padding:8px 16px;font-size:12px;">
          Refresh Page
        </button>
      </div>
    `;
  }
}

init();
