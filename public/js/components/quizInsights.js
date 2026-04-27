// ══════════════════════════════════════════════════════════════════════════════
// POST-QUIZ INSIGHTS & STATS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Show insights after quiz completion
 */
export async function showQuizInsights(data) {
  const {
    score,
    total,
    percentage,
    correctConcepts = [],
    weakConcepts = [],
    timeSpent,
    userId
  } = data;

  // Create modal
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  `;

  // Get user progress stats
  let stats = null;
  if (userId) {
    try {
      const res = await fetch(`/api/progress/stats?userId=${userId}&days=7`);
      if (res.ok) stats = await res.json();
    } catch (err) {
      console.log("Could not fetch stats:", err);
    }
  }

  const performanceEmoji = percentage === 100 ? "🏆" : 
                          percentage >= 80 ? "🎉" : 
                          percentage >= 60 ? "👍" : 
                          percentage >= 40 ? "📚" : "💪";

  const performanceMessage = percentage === 100 ? "Perfect score! Outstanding!" :
                             percentage >= 80 ? "Great job! You've mastered this!" :
                             percentage >= 60 ? "Good work! Keep practicing!" :
                             percentage >= 40 ? "Not bad! Review and try again!" :
                             "Keep going! Every attempt makes you stronger!";

  const accuracy = stats?.overallAccuracy || 0;
  const streak = stats?.currentStreak || 0;
  const totalQuizzes = stats?.totalQuizzes || 0;

  const card = document.createElement("div");
  card.className = "card";
  card.style.cssText = `
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideInUp 0.4s ease;
  `;

  card.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 80px; margin-bottom: 12px;">${performanceEmoji}</div>
      <h2 style="margin: 0 0 8px 0; font-size: 28px;">Quiz Complete!</h2>
      <p class="muted" style="font-size: 16px;">${performanceMessage}</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-label">Score</div>
        <div class="stat-value" style="color: ${percentage >= 60 ? 'var(--green)' : 'var(--orange)'};">${score}/${total}</div>
        <div class="stat-change">${percentage}%</div>
      </div>

      ${stats ? `
        <div class="stat-card">
          <div class="stat-label">Accuracy</div>
          <div class="stat-value" style="font-size: 32px;">${accuracy}%</div>
          <div class="stat-change neutral">Overall</div>
        </div>

        ${streak > 0 ? `
          <div class="stat-card">
            <div class="stat-label">Streak</div>
            <div class="stat-value" style="font-size: 32px; color: var(--orange);">${streak}🔥</div>
            <div class="stat-change positive">Days</div>
          </div>
        ` : ''}

        <div class="stat-card">
          <div class="stat-label">Total Quizzes</div>
          <div class="stat-value" style="font-size: 32px;">${totalQuizzes}</div>
          <div class="stat-change neutral">Completed</div>
        </div>
      ` : ''}
    </div>

    ${correctConcepts.length > 0 ? `
      <div class="insight-card" style="background: linear-gradient(135deg, var(--green) 0%, #00a86b 100%); margin-bottom: 16px;">
        <h3 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
          <span>✓</span> Strengths
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${correctConcepts.map(c => `
            <span class="pill" style="background: rgba(255,255,255,0.2); border-color: white; color: white;">${c}</span>
          `).join("")}
        </div>
      </div>
    ` : ''}

    ${weakConcepts.length > 0 ? `
      <div class="warning-state" style="margin-bottom: 16px;">
        <div class="state-icon">📖</div>
        <div class="state-content">
          <div class="state-title">Areas to Review</div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
            ${weakConcepts.map(c => `
              <span class="pill" style="border-color: var(--orange); background: var(--paper);">${c}</span>
            `).join("")}
          </div>
        </div>
      </div>
    ` : ''}

    ${timeSpent ? `
      <div style="text-align: center; padding: 16px; background: var(--paper-2); border-radius: 8px; margin-bottom: 16px;">
        <div style="font-weight: 700; font-size: 14px; color: var(--muted); margin-bottom: 4px;">TIME SPENT</div>
        <div style="font-size: 24px; font-weight: 900;">${Math.ceil(timeSpent / 60)} min</div>
      </div>
    ` : ''}

    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
      <button id="insightsContinue" class="btn" style="padding: 14px 32px; font-size: 16px;">Continue</button>
      ${percentage < 80 ? `
        <button id="insightsRetry" class="btn btn-secondary" style="padding: 14px 32px; font-size: 16px;">Try Again</button>
      ` : ''}
    </div>
  `;

  modal.appendChild(card);
  document.body.appendChild(modal);

  // Add animations
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideInUp {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(styleEl);

  return new Promise((resolve) => {
    card.querySelector("#insightsContinue")?.addEventListener("click", () => {
      modal.style.animation = "fadeOut 0.3s ease";
      setTimeout(() => modal.remove(), 300);
      resolve("continue");
    });

    card.querySelector("#insightsRetry")?.addEventListener("click", () => {
      modal.style.animation = "fadeOut 0.3s ease";
      setTimeout(() => modal.remove(), 300);
      resolve("retry");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.animation = "fadeOut 0.3s ease";
        setTimeout(() => modal.remove(), 300);
        resolve("continue");
      }
    });
  });
}

/**
 * Show skeleton loader for quiz/arena
 */
export function showSkeletonLoader(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="skeleton-card" style="margin-bottom: 20px;">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text long"></div>
      <div class="skeleton skeleton-text medium"></div>
    </div>
    
    <div class="skeleton-card" style="margin-bottom: 20px;">
      <div class="skeleton skeleton-text short"></div>
      <div style="display: grid; gap: 12px; margin-top: 16px;">
        <div class="skeleton skeleton-button"></div>
        <div class="skeleton skeleton-button"></div>
        <div class="skeleton skeleton-button"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
    </div>

    <div style="display: flex; justify-content: center; gap: 12px;">
      <div class="skeleton skeleton-button"></div>
      <div class="skeleton skeleton-button"></div>
    </div>
  `;
}

/**
 * Show skeleton grid for lessons
 */
export function showSkeletonGrid(containerId, count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const skeletons = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text long"></div>
      <div class="skeleton skeleton-text medium"></div>
      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <div class="skeleton" style="width: 80px; height: 32px;"></div>
        <div class="skeleton" style="width: 80px; height: 32px;"></div>
      </div>
    </div>
  `).join("");

  container.innerHTML = skeletons;
}
