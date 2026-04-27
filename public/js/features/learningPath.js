import { getSupabase } from "../shared/supabaseClient.js";

/**
 * Process document into smart learning path
 */
export async function processIntoLearningPath(userId, documentName, documentText) {
  try {
    const response = await fetch("/api/learning/process-material", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        documentName,
        documentText,
        sourceType: 'document'
      })
    });

    if (!response.ok) throw new Error("Processing failed");

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error processing into learning path:", error);
    throw error;
  }
}

/**
 * Get user's learning path
 */
export async function getLearningPath(userId, sourceType = null) {
  try {
    const url = sourceType
      ? `/api/learning/path/${userId}?sourceType=${sourceType}`
      : `/api/learning/path/${userId}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch learning path");

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error getting learning path:", error);
    return { path: [], totalUnits: 0, completedUnits: 0 };
  }
}

/**
 * Update learning unit progress
 */
export async function updateUnitProgress(userId, unitId, progressPercentage, completed = false) {
  try {
    const response = await fetch("/api/learning/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        unitId,
        progressPercentage,
        completed
      })
    });

    if (!response.ok) throw new Error("Failed to update progress");

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating progress:", error);
    return { success: false };
  }
}

/**
 * Render learning path UI
 */
export function renderLearningPath(container, pathData, userId) {
  const { path, totalUnits, completedUnits, currentUnit } = pathData;

  if (!path || path.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px 20px;">
        <p class="muted" style="font-size:14px;margin-bottom:16px;">
          📚 No learning path yet. Process a document to create your personalized learning path!
        </p>
      </div>
    `;
    return;
  }

  const progressPercentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:18px;margin:0;">📖 Your Learning Path</h3>
        <span style="font-size:13px;font-weight:700;color:var(--blue);">
          ${completedUnits}/${totalUnits} units completed
        </span>
      </div>
      
      <!-- Progress bar -->
      <div class="progress-track" style="margin-bottom:8px;">
        <div class="progress-fill" style="width:${progressPercentage}%;background:var(--blue);"></div>
      </div>
      <p class="muted" style="font-size:11px;margin:0;">
        ${progressPercentage}% complete
      </p>
    </div>

    <div id="learningUnitsContainer" style="display:grid;gap:12px;">
      ${path.map(pathItem => renderLearningUnit(pathItem, userId)).join('')}
    </div>
  `;

  // Add event listeners
  path.forEach(pathItem => {
    const unitEl = container.querySelector(`[data-unit-id="${pathItem.learning_unit_id}"]`);
    if (unitEl && pathItem.status !== 'locked') {
      unitEl.addEventListener('click', () => openLearningUnit(pathItem, userId));
    }
  });
}

/**
 * Render individual learning unit card
 */
function renderLearningUnit(pathItem, userId) {
  const unit = pathItem.learning_unit;
  const isLocked = pathItem.status === 'locked';
  const isCompleted = pathItem.status === 'completed';
  const isInProgress = pathItem.status === 'in_progress';
  const isAvailable = pathItem.status === 'available';

  const statusIcon = isCompleted ? '✅' : isInProgress ? '📝' : isAvailable ? '🔓' : '🔒';
  const statusText = isCompleted ? 'Completed' : isInProgress ? 'In Progress' : isAvailable ? 'Start' : 'Locked';
  const statusColor = isCompleted ? 'var(--green)' : isInProgress ? 'var(--blue)' : isAvailable ? 'var(--text)' : 'var(--muted)';

  return `
    <button class="card" 
      data-unit-id="${pathItem.learning_unit_id}"
      style="text-align:left;cursor:${isLocked ? 'not-allowed' : 'pointer'};opacity:${isLocked ? '0.6' : '1'};
        ${isLocked ? '' : 'transition: transform 0.2s;'}
        ${isLocked ? '' : 'hover:transform: translateX(4px);'}">
      
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <div style="flex:1;min-width:0;">
          <h4 style="font-size:15px;margin:0 0 4px;line-height:1.3;">
            ${statusIcon} ${escapeHTML(unit.title)}
          </h4>
          <p class="muted" style="font-size:11px;margin:0;">
            ⏱ ${unit.estimated_time_minutes} min · 
            Difficulty: ${'⭐'.repeat(unit.difficulty_level)}
          </p>
        </div>
        
        <div style="text-align:right;flex-shrink:0;margin-left:12px;">
          <span style="font-size:11px;font-weight:700;color:${statusColor};">
            ${statusText}
          </span>
          ${!isLocked && !isCompleted ? `
            <div style="margin-top:4px;">
              <div class="progress-track" style="width:60px;height:6px;">
                <div class="progress-fill" style="width:${pathItem.progress_percentage}%;background:var(--blue);"></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      ${unit.concepts && JSON.parse(unit.concepts).length > 0 ? `
        <div style="margin-top:8px;">
          <p class="muted" style="font-size:10px;margin:0 0 4px;">Key concepts:</p>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${JSON.parse(unit.concepts).slice(0, 5).map(concept => `
              <span style="font-size:9px;padding:2px 6px;background:var(--paper-2);
                border:2px solid var(--text);border-radius:4px;font-weight:700;">
                ${escapeHTML(concept)}
              </span>
            `).join('')}
            ${JSON.parse(unit.concepts).length > 5 ? `
              <span style="font-size:9px;color:var(--muted);">+${JSON.parse(unit.concepts).length - 5} more</span>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </button>
  `;
}

/**
 * Open learning unit in modal for study
 */
function openLearningUnit(pathItem, userId) {
  const unit = pathItem.learning_unit;

  const modal = document.createElement('div');
  modal.className = 'learning-unit-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;
    display:grid;place-items:center;padding:20px;
    animation: fadeIn 0.3s ease;
    backdrop-filter: blur(4px);`;

  modal.innerHTML = `
    <div class="learning-unit-container" style="max-width:900px;width:100%;max-height:92vh;
      background:var(--paper);border:4px solid var(--text);border-radius:16px;
      box-shadow:8px 8px 0 var(--text);overflow:hidden;display:flex;flex-direction:column;">
      
      <!-- Header -->
      <div style="padding:20px 24px;background:var(--paper-2);border-bottom:3px solid var(--text);
        display:flex;justify-content:space-between;align-items:start;gap:16px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <span class="pill" style="font-size:10px;padding:4px 10px;">
              ⏱ ${unit.estimated_time_minutes} min
            </span>
            <span class="pill" style="font-size:10px;padding:4px 10px;">
              ${'⭐'.repeat(unit.difficulty_level)} Difficulty
            </span>
          </div>
          <h2 style="font-size:22px;margin:0;line-height:1.3;">${escapeHTML(unit.title)}</h2>
        </div>
        <button id="closeUnitModal" class="btn btn-secondary" 
          style="padding:8px 12px;font-size:14px;flex-shrink:0;">
          ✕
        </button>
      </div>

      <!-- Progress Bar -->
      <div style="padding:16px 24px;background:var(--paper);border-bottom:2px solid var(--paper-2);">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;
          margin-bottom:6px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">
          <span>Your Progress</span>
          <span style="color:var(--blue);">${pathItem.progress_percentage}%</span>
        </div>
        <div class="progress-track" style="height:8px;">
          <div class="progress-fill" id="unitProgressBar" 
            style="width:${pathItem.progress_percentage}%;background:var(--blue);"></div>
        </div>
      </div>

      <!-- Content -->
      <div style="flex:1;overflow-y:auto;padding:28px 32px;line-height:1.8;">
        ${renderEnhancedContent(unit.content)}
      </div>

      <!-- Footer Actions -->
      <div style="padding:16px 24px;background:var(--paper-2);border-top:3px solid var(--text);
        display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;">
        <div style="font-size:12px;color:var(--muted);">
          ${pathItem.status === 'completed' ? '✅ Completed' : 
            pathItem.status === 'in_progress' ? '📝 In Progress' : 
            '🔓 Ready to learn'}
        </div>
        <div style="display:flex;gap:10px;">
          ${pathItem.status !== 'completed' ? `
            <button id="markCompleteBtn" class="btn" style="padding:12px 24px;font-size:14px;">
              ✅ Mark Complete
            </button>
          ` : `
            <button id="reviewUnitBtn" class="btn btn-secondary" style="padding:12px 24px;font-size:14px;">
              🔄 Review Again
            </button>
          `}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Render LaTeX with KaTeX - wait for it to load
  const renderLatex = () => {
    if (window.renderMathInElement) {
      try {
        const contentDiv = modal.querySelector('.card > div');
        if (contentDiv) {
          renderMathInElement(contentDiv, {
            delimiters: [
              {left: '\\(', right: '\\)', display: false},
              {left: '\\[', right: '\\]', display: true},
              {left: '$', right: '$', display: false},
              {left: '$$', right: '$$', display: true}
            ],
            throwOnError: false,
            trust: true
          });
        }
      } catch (e) {
        console.log('KaTeX rendering error:', e);
      }
    } else {
      // KaTeX not loaded yet, wait and retry
      setTimeout(renderLatex, 200);
    }
  };
  
  setTimeout(renderLatex, 150);

  // Close modal
  modal.querySelector('#closeUnitModal').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Mark complete
  const markCompleteBtn = modal.querySelector('#markCompleteBtn');
  if (markCompleteBtn) {
    markCompleteBtn.addEventListener('click', async () => {
      const result = await updateUnitProgress(userId, unit.id, 100, true);
      if (result.success) {
        modal.remove();
        // Refresh the learning path
        window.location.reload();
      }
    });
  }

  // Review (reset progress to in_progress)
  const reviewBtn = modal.querySelector('#reviewUnitBtn');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', async () => {
      await updateUnitProgress(userId, unit.id, 0, false);
      modal.remove();
      window.location.reload();
    });
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render enhanced content with LaTeX, highlights, examples, etc.
 */
function renderEnhancedContent(content) {
  if (!content) return '';

  let html = escapeHTML(content);

  // Replace [FORMULA]...[/FORMULA] with LaTeX rendering
  // Use $ delimiters - DON'T escape HTML first to preserve backslashes!
  const formulaPattern = /\[FORMULA\](.*?)\[\/FORMULA\]/g;
  const originalContent = content; // Keep original before escapeHTML
  
  // Extract formulas before escaping
  const formulas = [];
  let match;
  while ((match = formulaPattern.exec(originalContent)) !== null) {
    formulas.push(match[1].trim());
  }
  
  // Now escape and replace with placeholders
  html = escapeHTML(content);
  
  // Replace formula placeholders with actual LaTeX
  formulas.forEach((formula, index) => {
    const placeholder = escapeHTML(`[FORMULA]${formula}[/FORMULA]`);
    html = html.replace(placeholder, `<span class="formula-inline">$${formula}$</span>`);
  });

  // Replace [HIGHLIGHT]...[/HIGHLIGHT]
  html = html.replace(/\[HIGHLIGHT\](.*?)\[\/HIGHLIGHT\]/g, (match, text) => {
    return `<mark style="background:#fef08a;padding:2px 4px;border-radius:3px;
      font-weight:700;">${text}</mark>`;
  });

  // Replace [EXAMPLE]...[/EXAMPLE]
  html = html.replace(/\[EXAMPLE\](.*?)\[\/EXAMPLE\]/gs, (match, text) => {
    return `<div style="margin:16px 0;padding:16px;background:rgba(59,130,246,0.1);
      border-left:4px solid #3b82f6;border-radius:8px;">
      <div style="font-size:11px;font-weight:900;color:#3b82f6;margin-bottom:8px;
        text-transform:uppercase;letter-spacing:0.05em;">📘 Example</div>
      <div style="line-height:1.7;">${text}</div>
    </div>`;
  });

  // Replace [TIP]...[/TIP]
  html = html.replace(/\[TIP\](.*?)\[\/TIP\]/gs, (match, text) => {
    return `<div style="margin:16px 0;padding:16px;background:rgba(34,197,94,0.1);
      border-left:4px solid #22c55e;border-radius:8px;">
      <div style="font-size:11px;font-weight:900;color:#22c55e;margin-bottom:8px;
        text-transform:uppercase;letter-spacing:0.05em;">💡 Pro Tip</div>
      <div style="line-height:1.7;">${text}</div>
    </div>`;
  });

  // Replace [WARNING]...[/WARNING]
  html = html.replace(/\[WARNING\](.*?)\[\/WARNING\]/gs, (match, text) => {
    return `<div style="margin:16px 0;padding:16px;background:rgba(251,146,60,0.1);
      border-left:4px solid #fb923c;border-radius:8px;">
      <div style="font-size:11px;font-weight:900;color:#fb923c;margin-bottom:8px;
        text-transform:uppercase;letter-spacing:0.05em;">⚠️ Common Mistake</div>
      <div style="line-height:1.7;">${text}</div>
    </div>`;
  });

  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim());
  html = paragraphs.map(p => {
    // Check if already wrapped in div (from replacements above)
    if (p.trim().startsWith('<div')) return p;
    return `<p style="margin:0 0 16px;line-height:1.8;">${p}</p>`;
  }).join('');

  return html;
}

/**
 * Show processing modal with progress
 */
export function showProcessingModal() {
  const modal = document.createElement('div');
  modal.id = 'processingModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;
    display:grid;place-items:center;backdrop-filter:blur(8px);
    animation: fadeIn 0.3s ease;`;

  modal.innerHTML = `
    <div class="card" style="max-width:480px;width:90%;text-align:center;padding:40px 32px;
      border:4px solid var(--text);box-shadow:8px 8px 0 var(--text);">
      
      <!-- Animated Brain Icon -->
      <div style="font-size:64px;margin-bottom:20px;animation:pulse 2s ease-in-out infinite;">
        🧠
      </div>
      
      <h3 style="font-size:20px;margin:0 0 8px;letter-spacing:-0.02em;">
        AI Processing Your Material
      </h3>
      
      <p class="muted" style="font-size:13px;margin:0 0 24px;line-height:1.6;">
        Creating an optimized learning path with interactive study notes
      </p>
      
      <!-- Progress Bar -->
      <div class="progress-track" style="margin-bottom:20px;height:8px;">
        <div id="processingProgress" class="progress-fill" 
          style="width:20%;background:var(--blue);transition:width 0.5s ease;"></div>
      </div>
      
      <!-- Steps -->
      <div id="processingSteps" style="text-align:left;display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--paper-2);
          border-radius:8px;border:2px solid var(--text);">
          <div class="spinner" style="width:16px;height:16px;"></div>
          <span style="font-size:12px;font-weight:700;">Analyzing content structure...</span>
        </div>
      </div>
    </div>
  `;

  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(modal);
  return modal;
}

export function updateProcessingStep(message) {
  const steps = document.querySelector('#processingSteps');
  const progress = document.querySelector('#processingProgress');
  
  if (steps) {
    // Remove spinner from last step
    const lastStep = steps.querySelector('.spinner')?.parentElement;
    if (lastStep) {
      lastStep.innerHTML = `
        <span style="color:var(--green);font-size:16px;">✓</span>
        <span style="font-size:12px;font-weight:700;color:var(--muted);">
          ${lastStep.querySelector('span').textContent}
        </span>
      `;
    }
    
    // Add new step with spinner
    const newStep = document.createElement('div');
    newStep.style.cssText = `
      display:flex;align-items:center;gap:10px;padding:8px;
      background:var(--paper-2);border-radius:8px;border:2px solid var(--text);
      animation: slideIn 0.3s ease;`;
    newStep.innerHTML = `
      <div class="spinner" style="width:16px;height:16px;"></div>
      <span style="font-size:12px;font-weight:700;">${message}</span>
    `;
    steps.appendChild(newStep);
  }
  
  // Update progress bar
  if (progress) {
    const currentWidth = parseInt(progress.style.width) || 20;
    const newWidth = Math.min(95, currentWidth + 20);
    progress.style.width = `${newWidth}%`;
  }
}

export function closeProcessingModal() {
  const modal = document.querySelector('#processingModal');
  if (modal) modal.remove();
}
