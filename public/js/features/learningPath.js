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
    position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;
    display:flex;align-items:stretch;padding:0;
    animation: fadeIn 0.3s ease;
    backdrop-filter: blur(8px);`;

  modal.innerHTML = `
    <div class="learning-unit-container" style="width:100%;height:100vh;
      background:var(--paper);overflow:hidden;display:flex;flex-direction:column;">
      
      <!-- Academic Header -->
      <div style="padding:28px 48px;background:linear-gradient(135deg, var(--paper-2) 0%, var(--paper) 100%);
        border-bottom:4px solid var(--text);position:relative;">
        
        <!-- Top row: metadata + close -->
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <span style="font-size:11px;padding:6px 14px;background:var(--accent);color:white;
              font-weight:900;border-radius:6px;letter-spacing:0.03em;">
              UNIT ${pathItem.sequence_order}
            </span>
            <span class="pill" style="font-size:11px;padding:6px 14px;font-weight:700;">
              ⏱ ${unit.estimated_time_minutes} min
            </span>
            <span class="pill" style="font-size:11px;padding:6px 14px;font-weight:700;">
              ${'⭐'.repeat(unit.difficulty_level)}
            </span>
          </div>
          <button id="closeUnitModal" class="btn btn-secondary" style="padding:10px 20px;font-size:14px;font-weight:900;">
            ✕
          </button>
        </div>
        
        <!-- Title -->
        <h1 style="margin:0;font-size:32px;line-height:1.2;font-weight:900;letter-spacing:-0.03em;
          max-width:900px;">
          ${escapeHTML(unit.title)}
        </h1>
        
        <!-- Progress bar -->
        <div style="margin-top:20px;height:10px;background:rgba(0,0,0,0.1);border-radius:12px;overflow:hidden;
          border:3px solid var(--text);max-width:600px;">
          <div id="unitProgressBar" style="height:100%;background:var(--accent);width:${pathItem.progress_percentage || 0}%;
            transition:width 0.5s ease;"></div>
        </div>
      </div>

      <!-- Content - Academic Style -->
      <div style="flex:1;overflow-y:auto;padding:48px 0;background:var(--paper);">
        <div id="unitContent" style="max-width:840px;margin:0 auto;padding:0 56px;">
          
          <!-- Study Session Indicator -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:40px;
            padding-bottom:24px;border-bottom:3px solid var(--text);">
            <div style="width:10px;height:10px;background:var(--accent);border-radius:50%;
              animation:pulse 2s infinite;"></div>
            <span style="font-size:12px;font-weight:900;text-transform:uppercase;
              letter-spacing:0.1em;color:var(--muted);">Study Session</span>
          </div>
          
          <div style="line-height:2.1;font-size:17px;">
            ${renderEnhancedContent(unit.content)}
          </div>
          
          <!-- Concepts Covered -->
          ${unit.concepts && JSON.parse(unit.concepts).length > 0 ? `
            <div style="margin-top:56px;padding-top:40px;border-top:3px solid var(--text);">
              <h3 style="margin:0 0 20px;font-size:15px;font-weight:900;
                text-transform:uppercase;letter-spacing:0.05em;">
                📌 Key Concepts Mastered
              </h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
                ${JSON.parse(unit.concepts).map(concept => `
                  <div style="padding:14px 18px;background:var(--paper-2);
                    border:3px solid var(--text);border-radius:10px;">
                    <div style="font-weight:900;font-size:14px;line-height:1.4;">${escapeHTML(concept)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Footer Actions - Academic Style -->
      <div style="padding:28px 48px;background:var(--paper-2);border-top:4px solid var(--text);
        display:flex;justify-content:space-between;align-items:center;gap:20px;">
        <div style="flex:1;">
          ${pathItem.status === 'completed' ? `
            <button id="reviewUnitBtn" class="btn btn-secondary" style="padding:14px 24px;font-size:14px;font-weight:700;">
              🔄 Review This Unit
            </button>
          ` : `
            <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.5;">
              💡 Complete this unit to unlock the next one in your learning path
            </p>
          `}
        </div>
        <div style="display:flex;gap:12px;">
          ${pathItem.status !== 'completed' ? `
            <button id="markCompleteBtn" class="btn" style="padding:16px 32px;font-size:16px;font-weight:900;">
              ✅ Mark Complete
            </button>
          ` : `
            <div style="padding:14px 28px;background:#10b981;color:white;font-weight:900;
              border-radius:10px;border:3px solid #059669;font-size:15px;">
              ✓ Completed
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Render LaTeX with KaTeX - DIRECT rendering approach
  const renderLatex = () => {
    // Wait for KaTeX to load
    if (!window.katex) {
      setTimeout(renderLatex, 100);
      return;
    }
    
    try {
      // Find ALL formula spans and render them directly
      const contentDiv = document.getElementById('unitContent');
      if (!contentDiv) {
        console.warn('Unit content div not found');
        return;
      }
      
      const formulaSpans = contentDiv.querySelectorAll('.formula-inline[data-formula]');
      console.log(`Found ${formulaSpans.length} formulas to render`);
      
      formulaSpans.forEach(span => {
        const formula = span.getAttribute('data-formula');
        if (formula) {
          try {
            // Render directly into the span
            window.katex.render(formula, span, {
              throwOnError: false,
              displayMode: false,
              trust: true,
              strict: false
            });
          } catch (err) {
            console.error('Formula render error:', formula, err);
            span.textContent = formula; // Fallback to text
          }
        }
      });
      
      console.log('✅ KaTeX rendered all formulas');
    } catch (e) {
      console.error('❌ KaTeX error:', e);
    }
  };
  
  // Render after DOM is ready
  setTimeout(renderLatex, 300);

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
      markCompleteBtn.disabled = true;
      markCompleteBtn.textContent = 'Saving...';
      
      const result = await updateUnitProgress(userId, unit.id, 100, true);
      if (result.success) {
        // Don't reload - just close and show success
        modal.remove();
        
        // Show success toast
        if (window.showToast) {
          window.showToast('Unit completed! 🎉', 'success');
        }
        
        // Refresh ONLY the learning path container if it exists
        const pathContainer = document.getElementById('learningPathContainer');
        if (pathContainer && window.getLearningPath && window.renderLearningPath) {
          const pathData = await window.getLearningPath(userId);
          window.renderLearningPath(pathContainer, pathData, userId);
        }
      } else {
        markCompleteBtn.disabled = false;
        markCompleteBtn.textContent = '✅ Mark Complete';
        alert('Failed to save progress. Please try again.');
      }
    });
  }

  // Review (reset progress to in_progress)
  const reviewBtn = modal.querySelector('#reviewUnitBtn');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', async () => {
      reviewBtn.disabled = true;
      reviewBtn.textContent = 'Resetting...';
      
      await updateUnitProgress(userId, unit.id, 0, false);
      modal.remove();
      
      if (window.showToast) {
        window.showToast('Ready to review again!', 'info');
      }
      
      // Refresh the path
      const pathContainer = document.getElementById('learningPathContainer');
      if (pathContainer && window.getLearningPath && window.renderLearningPath) {
        const pathData = await window.getLearningPath(userId);
        window.renderLearningPath(pathContainer, pathData, userId);
      }
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

  // Replace [FORMULA]...[/FORMULA] with LaTeX rendering
  // NEW APPROACH: AI sends formulas WITHOUT backslashes, we add them here
  const formulaPattern = /\[FORMULA\](.*?)\[\/FORMULA\]/gs;
  
  const formulas = [];
  let match;
  while ((match = formulaPattern.exec(content)) !== null) {
    let formula = match[1].trim();
    
    // AUTO-FIX: Add backslashes to LaTeX commands
    // This works for BOTH new paths (no backslashes) AND old paths (corrupted backslashes)
    
    // Step 1: Remove any existing backslashes (clean slate)
    formula = formula.replace(/\\/g, '');
    
    // Step 2: Add backslashes to all LaTeX commands
    // Match word boundaries to avoid partial replacements
    
    // Math operators
    formula = formula.replace(/\bfrac\b/g, '\\frac');
    formula = formula.replace(/\bsqrt\b/g, '\\sqrt');
    formula = formula.replace(/\bint\b/g, '\\int');
    formula = formula.replace(/\bsum\b/g, '\\sum');
    formula = formula.replace(/\bprod\b/g, '\\prod');
    formula = formula.replace(/\blim\b/g, '\\lim');
    formula = formula.replace(/\binfty\b/g, '\\infty');
    
    // Trigonometric functions
    formula = formula.replace(/\bsin\b/g, '\\sin');
    formula = formula.replace(/\bcos\b/g, '\\cos');
    formula = formula.replace(/\btan\b/g, '\\tan');
    formula = formula.replace(/\bsec\b/g, '\\sec');
    formula = formula.replace(/\bcsc\b/g, '\\csc');
    formula = formula.replace(/\bcot\b/g, '\\cot');
    
    // Logarithms
    formula = formula.replace(/\blog\b/g, '\\log');
    formula = formula.replace(/\bln\b/g, '\\ln');
    
    // Greek letters (lowercase)
    formula = formula.replace(/\balpha\b/g, '\\alpha');
    formula = formula.replace(/\bbeta\b/g, '\\beta');
    formula = formula.replace(/\bgamma\b/g, '\\gamma');
    formula = formula.replace(/\bdelta\b/g, '\\delta');
    formula = formula.replace(/\bepsilon\b/g, '\\epsilon');
    formula = formula.replace(/\bzeta\b/g, '\\zeta');
    formula = formula.replace(/\beta\b/g, '\\eta');
    formula = formula.replace(/\btheta\b/g, '\\theta');
    formula = formula.replace(/\biota\b/g, '\\iota');
    formula = formula.replace(/\bkappa\b/g, '\\kappa');
    formula = formula.replace(/\blambda\b/g, '\\lambda');
    formula = formula.replace(/\bmu\b/g, '\\mu');
    formula = formula.replace(/\bnu\b/g, '\\nu');
    formula = formula.replace(/\bxi\b/g, '\\xi');
    formula = formula.replace(/\bpi\b/g, '\\pi');
    formula = formula.replace(/\brho\b/g, '\\rho');
    formula = formula.replace(/\bsigma\b/g, '\\sigma');
    formula = formula.replace(/\btau\b/g, '\\tau');
    formula = formula.replace(/\bupsilon\b/g, '\\upsilon');
    formula = formula.replace(/\bphi\b/g, '\\phi');
    formula = formula.replace(/\bchi\b/g, '\\chi');
    formula = formula.replace(/\bpsi\b/g, '\\psi');
    formula = formula.replace(/\bomega\b/g, '\\omega');
    
    // Greek letters (uppercase)
    formula = formula.replace(/\bGamma\b/g, '\\Gamma');
    formula = formula.replace(/\bDelta\b/g, '\\Delta');
    formula = formula.replace(/\bTheta\b/g, '\\Theta');
    formula = formula.replace(/\bLambda\b/g, '\\Lambda');
    formula = formula.replace(/\bXi\b/g, '\\Xi');
    formula = formula.replace(/\bPi\b/g, '\\Pi');
    formula = formula.replace(/\bSigma\b/g, '\\Sigma');
    formula = formula.replace(/\bPhi\b/g, '\\Phi');
    formula = formula.replace(/\bPsi\b/g, '\\Psi');
    formula = formula.replace(/\bOmega\b/g, '\\Omega');
    
    // Special symbols
    formula = formula.replace(/\bcdot\b/g, '\\cdot');
    formula = formula.replace(/\btimes\b/g, '\\times');
    formula = formula.replace(/\bpm\b/g, '\\pm');
    formula = formula.replace(/\bmp\b/g, '\\mp');
    formula = formula.replace(/\bleq\b/g, '\\leq');
    formula = formula.replace(/\bgeq\b/g, '\\geq');
    formula = formula.replace(/\bneq\b/g, '\\neq');
    formula = formula.replace(/\bapprox\b/g, '\\approx');
    formula = formula.replace(/\bequiv\b/g, '\\equiv');
    
    // Arrows
    formula = formula.replace(/\brightarrow\b/g, '\\rightarrow');
    formula = formula.replace(/\bleftarrow\b/g, '\\leftarrow');
    formula = formula.replace(/\bRightarrow\b/g, '\\Rightarrow');
    formula = formula.replace(/\bLeftarrow\b/g, '\\Leftarrow');
    
    formulas.push({ original: match[0], fixed: formula });
  }
  
  // Now escape HTML BUT keep formula placeholders
  let html = content;
  formulas.forEach((f, i) => {
    html = html.replace(f.original, `__FORMULA_${i}__`);
  });
  
  html = escapeHTML(html);
  
  // Replace placeholders with LaTeX using data attributes
  // We'll render these with KaTeX after inserting into DOM
  formulas.forEach((f, i) => {
    html = html.replace(`__FORMULA_${i}__`, `<span class="formula-inline" data-formula="${escapeHTML(f.fixed)}"></span>`);
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
