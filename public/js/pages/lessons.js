import { installFeedback, showToast, showLoadingOverlay, updateLoadingOverlay, hideLoadingOverlay } from "../shared/uiFeedback.js";
import { installThemeToggle } from "../shared/theme.js";
import { initHeader, nav } from "../shared/nav.js";
import { state } from "../shared/state.js";
import { saveLessonToStorage, getLessonsFromStorage, updateLessonProgress, deleteLessonFromStorage, renameLesson, moveLessonToCategory } from "../shared/lessonStorage.js";
import { getCategories, showCategoryManagerModal, showCategorySelector, showInputModal, showConfirmModal } from "../features/categoryManager.js";
import {
  renderChallenge,
  renderResultPhase
} from "../components/renderer.js";
import {
  processIntoLearningPath,
  getLearningPath,
  renderLearningPath
} from "../features/learningPath.js";

// Expose globally for unit modal callbacks
window.getLearningPath = getLearningPath;
window.renderLearningPath = renderLearningPath;
window.showToast = showToast;

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

  // Check URL hash for navigation
  const hash = window.location.hash;
  
  cachedLessons = await getLessonsFromStorage(currentUser.id);
  
  // If coming from dashboard My Lessons link, always show My Lessons
  console.log('Init: hash =', hash, ', referrer =', document.referrer);
  
  if (hash === '#my-lessons' || hash === '#my-lessons-paths' || document.referrer.includes('/dashboard')) {
    const activeTab = hash === '#my-lessons-paths' ? 'paths' : 'lessons';
    console.log('Showing My Lessons with tab:', activeTab);
    showMyLessons(activeTab);
  } else if (cachedLessons.length > 0) {
    showMyLessons('lessons');
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

async function showMyLessons(activeTab = 'lessons') {
  console.log('showMyLessons called with tab:', activeTab);
  showSection("myLessonsSection");
  
  // Activate the correct tab
  if (activeTab === 'paths') {
    el("myLessonsTab")?.classList.remove("auth-tab-active");
    el("learningPathsTab")?.classList.add("auth-tab-active");
    
    const quickPanel = el("quickLessonsPanel");
    const pathsPanel = el("learningPathsPanel");
    
    if (quickPanel) quickPanel.style.display = "none";
    if (pathsPanel) pathsPanel.style.display = "block";
    
    await renderLearningPathsGrid();
  } else {
    el("myLessonsTab")?.classList.add("auth-tab-active");
    el("learningPathsTab")?.classList.remove("auth-tab-active");
    
    const quickPanel = el("quickLessonsPanel");
    const pathsPanel = el("learningPathsPanel");
    
    if (quickPanel) quickPanel.style.display = "block";
    if (pathsPanel) pathsPanel.style.display = "none";
    
    await renderMyLessons();
  }
}

// Make it available globally for learningPath.js
window.showMyLessons = showMyLessons;

async function renderMyLessons() {
  cachedLessons = await getLessonsFromStorage(currentUser?.id);
  const categories = await getCategories(currentUser?.id);
  const grid = el("lessonCardsGrid");
  if (!grid) return;

  if (!cachedLessons.length) {
    grid.innerHTML = `
      <div class="lessons-empty">
        <div class="empty-state-icon" style="font-size:64px;opacity:0.2;">▣</div>
        <h2 class="empty-state-title">No lessons yet</h2>
        <p class="empty-state-description">
          Create your first AI-powered lesson from any document or topic.
        </p>
        <div class="empty-state-actions mt-6">
          <button id="firstLessonBtn" class="btn btn-lg">Create Lesson</button>
        </div>
      </div>`;
    el("firstLessonBtn")?.addEventListener("click", () => showSection("uploadSection"));
    return;
  }

  // Group lessons by category
  const grouped = {};
  const uncategorized = [];
  
  cachedLessons.forEach(lesson => {
    if (lesson.categoryId) {
      if (!grouped[lesson.categoryId]) grouped[lesson.categoryId] = [];
      grouped[lesson.categoryId].push(lesson);
    } else {
      uncategorized.push(lesson);
    }
  });

  // Count lessons per category
  const categoryCounts = {};
  categories.forEach(cat => {
    categoryCounts[cat.id] = (grouped[cat.id] || []).length;
  });

  // Render with sidebar layout
  let html = `
    <div class="lessons-wrapper">
    <div class="lessons-container">
      <!-- Sidebar -->
      <div class="lessons-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">Workspace</div>
          <div id="categoryFilter">
            <div class="category-item active" data-category="all">
              <span class="category-icon">▣</span>
              <span class="category-name">All Lessons</span>
              <span class="category-count">${cachedLessons.length}</span>
            </div>
            ${categories.map(cat => {
              const icon = getCategoryIcon(cat.name);
              return `
                <div class="category-item" data-category="${cat.id}">
                  <span class="category-icon">${icon}</span>
                  <span class="category-name">${escapeHTML(cat.name)}</span>
                  <span class="category-count">${categoryCounts[cat.id] || 0}</span>
                </div>
              `;
            }).join("")}
            ${uncategorized.length > 0 ? `
              <div class="category-item" data-category="uncategorized">
                <span class="category-icon">○</span>
                <span class="category-name">Uncategorized</span>
                <span class="category-count">${uncategorized.length}</span>
              </div>
            ` : ''}
          </div>
          
          <button id="manageCategoriesBtn" class="btn btn-ghost btn-sm w-full mt-4">
            Manage
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="lessons-main">
        <div class="lessons-header">
          <div>
            <h1 class="lessons-title">All Lessons</h1>
            <div class="lessons-subtitle" id="lessonsSubtitle">${cachedLessons.length} total</div>
          </div>
          <div class="lessons-actions">
            <button id="newLessonFromGridBtn" class="btn">+ New Lesson</button>
          </div>
        </div>
        
        <div class="lessons-grid" id="lessonsGridContent">
          ${renderLessonsForCategory('all', categories, grouped, uncategorized)}
        </div>
      </div>
    </div>
    </div>
  `;

  grid.innerHTML = html;

  // Category filter
  document.querySelectorAll('[data-category]').forEach(item => {
    item.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      // Update title
      const categoryId = item.dataset.category;
      const category = categories.find(c => c.id === categoryId);
      const titleEl = document.querySelector('.lessons-title');
      
      if (categoryId === 'all') {
        titleEl.textContent = 'All Lessons';
      } else if (categoryId === 'uncategorized') {
        titleEl.textContent = 'Uncategorized';
      } else if (category) {
        titleEl.textContent = category.name;
      }

      // Filter lessons
      const gridContent = document.getElementById('lessonsGridContent');
      gridContent.innerHTML = renderLessonsForCategory(categoryId, categories, grouped, uncategorized);
      attachLessonCardListeners();
    });
  });

  // Manage categories button
  el("manageCategoriesBtn")?.addEventListener("click", () => {
    showCategoryManagerModal(currentUser.id, renderMyLessons);
  });

  // New lesson button
  el("newLessonFromGridBtn")?.addEventListener("click", () => showSection("uploadSection"));

  // Attach event listeners
  attachLessonCardListeners();
}

function renderLessonsForCategory(categoryId, categories, grouped, uncategorized) {
  let lessons = [];
  
  if (categoryId === 'all') {
    lessons = cachedLessons;
  } else if (categoryId === 'uncategorized') {
    lessons = uncategorized;
  } else {
    lessons = grouped[categoryId] || [];
  }

  if (lessons.length === 0) {
    return `
      <div class="lessons-empty">
        <div class="empty-state-icon" style="font-size:48px;opacity:0.3;">○</div>
        <h3 class="empty-state-title">No lessons in this category</h3>
        <p class="empty-state-description">Create a new lesson or move existing ones here.</p>
      </div>
    `;
  }

  return lessons.map(renderLessonCard).join("");
}

// Helper for professional category icons
function getCategoryIcon(categoryName) {
  const name = categoryName.toLowerCase();
  if (name.includes('math') || name.includes('calculus') || name.includes('algebra')) return '∑';
  if (name.includes('science') || name.includes('physics') || name.includes('chemistry')) return '⚛';
  if (name.includes('history')) return '◷';
  if (name.includes('language') || name.includes('english')) return '◈';
  if (name.includes('code') || name.includes('programming')) return '{ }';
  if (name.includes('art') || name.includes('design')) return '◐';
  return '●';
}

function renderLessonCard(entry) {
  const { label, btnText, primary } = statusInfo(entry);
  const score = entry.lastQuizScore;
  const hasPct = score !== null && score !== undefined;
  const color = scoreColor(score);
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return `
    <div class="lesson-card">
      <div class="lesson-card-header">
        <div style="flex:1;min-width:0;">
          <h3 class="lesson-card-title lesson-title" data-lesson-id="${entry.id}" title="Click to rename">
            ${escapeHTML(entry.displayTitle)}
            <span class="rename-icon">✏️</span>
          </h3>
          <div class="lesson-card-meta">
            <span>${escapeHTML(entry.language)}</span>
            <span>•</span>
            <span>${date}</span>
          </div>
        </div>
        <span style="flex-shrink:0;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:900;
                     background:${color};color:${score === null ? "var(--text)" : "white"};
                     border:2px solid ${color};text-transform:uppercase;letter-spacing:0.05em;">
          ${escapeHTML(label)}
        </span>
      </div>

      ${hasPct ? `
        <div class="lesson-card-progress">
          <div class="progress-label">
            <span>Quiz Score</span>
            <span style="color:${color};">${score}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${score}%;background:${color};"></div>
          </div>
        </div>
      ` : ''}

      ${entry.reviewTopics?.length && score !== 100 && score !== null ? `
        <div style="margin-bottom:var(--space-4);">
          <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:var(--space-2);">
            Topics to Review
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);">
            ${entry.reviewTopics.map(t => `
              <span class="pill" style="font-size:11px;background:rgba(255,92,92,0.1);color:var(--red);border-color:var(--red);">
                ${escapeHTML(t)}
              </span>
            `).join("")}
          </div>
        </div>
      ` : ''}

      <div class="lesson-card-actions">
        <button class="btn${primary ? "" : " btn-secondary"} btn-sm" data-open="${escapeHTML(entry.id)}" style="flex:1;">
          ${escapeHTML(btnText)}
        </button>
        <button class="btn btn-ghost btn-sm" data-move="${escapeHTML(entry.id)}" title="Move to category">
          Move
        </button>
        <button class="btn btn-ghost btn-sm" data-delete="${escapeHTML(entry.id)}" title="Delete">
          Delete
        </button>
      </div>
    </div>`;
}

function attachLessonCardListeners() {
  // Open lesson
  document.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => openLesson(btn.dataset.open));
  });

  // Rename (click on title)
  document.querySelectorAll(".lesson-title").forEach(title => {
    title.addEventListener("click", async () => {
      const id = title.dataset.lessonId;
      const lesson = cachedLessons.find(l => l.id === id);
      if (!lesson) return;

      showInputModal("Rename Lesson", "New name:", async (newTitle) => {
        if (!newTitle || newTitle === lesson.displayTitle) return;
        await renameLesson(id, currentUser.id, newTitle);
        showToast("Lesson renamed!", "success");
        await renderMyLessons();
      });
    });
  });

  // Move to category
  document.querySelectorAll("[data-move]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.move;
      const lesson = cachedLessons.find(l => l.id === id);
      if (!lesson) return;

      showCategorySelector(currentUser.id, lesson.categoryId, async (categoryId) => {
        await moveLessonToCategory(id, currentUser.id, categoryId);
        showToast("Lesson moved!", "success");
        await renderMyLessons();
      });
    });
  });

  // Delete
  document.querySelectorAll("[data-delete]").forEach(btn => {
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
  el("backToMyLessonsBtn")?.addEventListener("click",         () => showMyLessons('lessons'));
  el("backToMyLessonsFromLesson")?.addEventListener("click",  () => showMyLessons('lessons'));
  el("backToMyLessonsFromReport")?.addEventListener("click",  () => showMyLessons('lessons'));
  el("backToMyLessonsFromPath")?.addEventListener("click",    () => showMyLessons('paths'));
  el("makeQuizBtn")?.addEventListener("click",                generateQuiz);
  el("backToLessonBtn")?.addEventListener("click",            () => showSection("lessonSection"));
  el("submitAnswerBtn")?.addEventListener("click",            submitLessonAnswer);
  el("quizNextBtn")?.addEventListener("click",                nextQuestion);
  el("quizFinishBtn")?.addEventListener("click",              generateReport);
  el("retakeQuizBtn")?.addEventListener("click",              startQuiz);
  
  // Tab switching in My Lessons
  el("tabLessons")?.addEventListener("click", () => {
    el("tabLessons")?.classList.add("auth-tab-active");
    el("tabLearningPaths")?.classList.remove("auth-tab-active");
    el("lessonCardsGrid")?.classList.remove("hidden");
    el("learningPathsGrid")?.classList.add("hidden");
  });
  
  el("tabLearningPaths")?.addEventListener("click", async () => {
    el("tabLessons")?.classList.remove("auth-tab-active");
    el("tabLearningPaths")?.classList.add("auth-tab-active");
    el("lessonCardsGrid")?.classList.add("hidden");
    el("learningPathsGrid")?.classList.remove("hidden");
    await renderLearningPathsGrid();
  });
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
      
      // For topics, create learning path directly from topic text
      docName = `Learning: ${topic.substring(0, 50)}`;
      textToProcess = topic;
      
      // Continue processing below (skip file extraction)
    } else {
      const file = el("lessonFileInput").files[0];
      if (!file) {
        statusEl.textContent = "Choose a file first.";
        showToast("Choose a file first.", "info");
        return;
      }

      // Extract text from file
      try {
        showLoadingOverlay({
          title: "Reading Document",
          message: "Extracting text...",
          steps: ["Reading file", "Extracting text", "Processing"]
        });

        const form = new FormData();
        form.append("document", file);
        if (currentUser?.id) form.append("userId", currentUser.id);

        updateLoadingOverlay("Processing document...", 50);
        const res = await fetch("/api/lessons/generate", { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Could not read document.");
        }

        textToProcess = data.documentText;
        docName = file.name;
        documentText = textToProcess; // Cache it

        updateLoadingOverlay("Complete!", 100);
        await new Promise(resolve => setTimeout(resolve, 300));
        hideLoadingOverlay();

      } catch (error) {
        console.error("Error reading document:", error);
        hideLoadingOverlay();
        showToast("Failed to read document. Please try again.", "error");
        return;
      }
    }
  }

  try {
    showLoadingOverlay({
      title: "Creating Smart Learning Path",
      message: "AI is analyzing your material...",
      steps: ["Analyzing document", "Creating units", "Extracting concepts", "Building path"]
    });
    
    updateLoadingOverlay("Processing with AI...", 25);
    const result = await processIntoLearningPath(
      currentUser.id,
      docName,
      textToProcess
    );

    updateLoadingOverlay("Structuring units...", 70);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    updateLoadingOverlay("Complete!", 100);
    await new Promise(resolve => setTimeout(resolve, 400));

    weeklyUsage.lessons = Math.min(3, weeklyUsage.lessons + 1);
    updateUsageBanner();

    hideLoadingOverlay();
    
    showToast(`🎉 Smart Learning Path created with ${result.units.length} units!`, "success");
    
    // Wait a moment for DB to finish, then navigate
    setTimeout(() => {
      showSection("learningPathSection");
    }, 500);

  } catch (error) {
    console.error("Smart processing error:", error);
    hideLoadingOverlay();
    showToast("Failed to create learning path. Please try again.", "error");
  }
}

async function loadLearningPath() {
  if (!currentUser) return;

  const container = el("learningPathContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="card">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width: 60%;"></div>
      <div class="skeleton skeleton-card mt-4"></div>
    </div>`;

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

async function renderLearningPathsGrid() {
  if (!currentUser) return;

  const container = el("learningPathsGrid");
  if (!container) return;

  container.innerHTML = '<div class="card" style="text-align:center;padding:32px;"><div class="spinner"></div></div>';

  try {
    const pathData = await getLearningPath(currentUser.id);
    
    if (!pathData.path || pathData.path.length === 0) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">🧠</div>
            <h2 class="empty-state-title">No Learning Paths Yet</h2>
            <p class="empty-state-description">
              Create your first AI-powered learning path by uploading a document and clicking "Smart Learning Path". Get structured, interactive units designed for maximum learning efficiency.
            </p>
            <div class="empty-state-actions">
              <button onclick="document.getElementById('newLessonFromGridBtn').click()" class="btn">
                Create First Learning Path
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Group units by source
    const grouped = {};
    pathData.path.forEach(item => {
      const source = item.learning_unit?.source_name || 'Untitled';
      if (!grouped[source]) {
        grouped[source] = [];
      }
      grouped[source].push(item);
    });

    // Render grouped paths
    const html = Object.keys(grouped).map(sourceName => {
      const units = grouped[sourceName];
      const completed = units.filter(u => u.status === 'completed').length;
      const total = units.length;
      const progress = Math.round((completed / total) * 100);

      return `
        <div class="card">
          <h3 style="font-size:18px;margin:0 0 12px;">📖 ${escapeHTML(sourceName)}</h3>
          <div style="display:flex;gap:16px;align-items:center;margin-bottom:12px;">
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px;">
                <span>Progress</span>
                <span style="color:var(--blue);">${completed}/${total} units</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${progress}%;background:var(--blue);"></div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary view-path-btn" data-source="${escapeHTML(sourceName)}"
                style="padding:8px 16px;font-size:12px;flex:1;">
                ${completed === total ? 'Review' : 'Continue'} →
              </button>
              <button class="btn btn-secondary delete-path-btn" data-source="${escapeHTML(sourceName)}" 
                data-units="${total}"
                style="padding:8px 12px;font-size:12px;background:var(--red);" 
                title="Delete this learning path">
                🗑
              </button>
            </div>
          </div>
          <p class="muted" style="font-size:11px;margin:0;">
            ${total} learning units · ~${total * 15}-${total * 20} minutes total
          </p>
        </div>
      `;
    }).join('');
    
    container.innerHTML = html;
    
    // Add event listeners for Continue buttons
    container.querySelectorAll('.view-path-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sourceName = btn.dataset.source;
        console.log('Continue clicked for:', sourceName);
        
        // Navigate to learning path section
        showSection("learningPathSection");
        
        // Wait a moment for section to show
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now load and render the SPECIFIC path for this source
        const pathContainer = el("learningPathContainer");
        if (pathContainer && currentUser) {
          pathContainer.innerHTML = '<div class="card" style="text-align:center;padding:32px;"><div class="spinner"></div></div>';
          
          try {
            const fullPathData = await getLearningPath(currentUser.id);
            console.log('Full path data:', fullPathData);
            
            // FILTER to only this source's units
            const filteredPath = fullPathData.path.filter(p => 
              p.learning_unit?.source_name === sourceName
            );
            
            console.log('Filtered to source:', sourceName, 'Units:', filteredPath.length);
            
            const filteredData = {
              ...fullPathData,
              path: filteredPath,
              totalUnits: filteredPath.length,
              completedUnits: filteredPath.filter(p => p.status === 'completed').length,
              currentUnit: filteredPath.find(p => p.status === 'in_progress') || filteredPath.find(p => p.status === 'available')
            };
            
            renderLearningPath(pathContainer, filteredData, currentUser.id);
          } catch (error) {
            console.error('Error loading path:', error);
            pathContainer.innerHTML = `
              <div class="card" style="text-align:center;padding:32px;">
                <p class="muted">Failed to load learning path</p>
                <button onclick="window.location.reload()" class="btn btn-secondary" style="margin-top:12px;">
                  Refresh
                </button>
              </div>
            `;
          }
        }
      });
    });
    
    // Add delete buttons
    container.querySelectorAll('.delete-path-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sourceName = btn.dataset.source;
        const unitsCount = btn.dataset.units;
        
        // Create beautiful confirmation modal
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
          position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;
          display:grid;place-items:center;padding:20px;
          animation: fadeIn 0.2s ease;backdrop-filter:blur(6px);`;
        
        confirmModal.innerHTML = `
          <div style="max-width:440px;width:100%;background:var(--paper);
            border:4px solid var(--text);border-radius:16px;
            box-shadow:8px 8px 0 var(--text);padding:32px;text-align:center;">
            
            <div style="font-size:48px;margin-bottom:16px;">🗑️</div>
            
            <h3 style="margin:0 0 12px;font-size:20px;">Delete Learning Path?</h3>
            
            <p style="margin:0 0 8px;color:var(--muted);line-height:1.6;">
              Are you sure you want to delete
            </p>
            <p style="margin:0 0 20px;font-weight:900;font-size:16px;color:var(--accent);">
              "${sourceName}"
            </p>
            
            <div style="padding:12px;background:rgba(239,68,68,0.1);
              border:2px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#ef4444;font-weight:700;">
                ⚠️ This will permanently remove all ${unitsCount} learning units
              </p>
            </div>
            
            <div style="display:flex;gap:12px;justify-content:center;">
              <button id="cancelDelete" class="btn btn-secondary" style="padding:12px 24px;">
                Cancel
              </button>
              <button id="confirmDelete" class="btn" style="padding:12px 24px;
                background:#ef4444;border-color:#ef4444;">
                🗑️ Delete Forever
              </button>
            </div>
          </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        // Cancel button
        confirmModal.querySelector('#cancelDelete').addEventListener('click', () => {
          confirmModal.remove();
        });
        
        // Click outside to cancel
        confirmModal.addEventListener('click', (ev) => {
          if (ev.target === confirmModal) confirmModal.remove();
        });
        
        // Confirm delete button
        confirmModal.querySelector('#confirmDelete').addEventListener('click', async () => {
          const deleteConfirmBtn = confirmModal.querySelector('#confirmDelete');
          deleteConfirmBtn.disabled = true;
          deleteConfirmBtn.textContent = 'Deleting...';
          
          try {
            // Delete all units for this source
            const response = await fetch('/api/learning/delete-path', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: currentUser.id,
                sourceName: sourceName
              })
            });
            
            if (response.ok) {
              confirmModal.remove();
              showToast(`Deleted "${sourceName}" ✨`, 'success');
              await renderLearningPathsGrid(); // Refresh
            } else {
              throw new Error('Delete failed');
            }
          } catch (error) {
            console.error('Delete error:', error);
            confirmModal.remove();
            showToast('Failed to delete learning path', 'error');
          }
        });
      });
    });

  } catch (error) {
    console.error("Error rendering learning paths:", error);
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:32px;">
        <p class="muted">Failed to load learning paths</p>
      </div>
    `;
  }
}

init();
