import { getSupabase } from "../shared/supabaseClient.js";
import { initHighlighting, clearAllHighlights } from "./highlighting.js";

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
  const allCompleted = completedUnits === totalUnits && totalUnits > 0;
  const sourceName = path[0]?.learning_unit?.source_name || "Learning Path";

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

    ${allCompleted ? `
      <div class="completion-banner">
        <div class="completion-content">
          <div class="completion-icon">🎉</div>
          <h2>Congratulations! Path Completed!</h2>
          <p>You've finished all units in this learning path. What's next?</p>
          <div class="completion-actions">
            <button class="btn btn-primary generate-quiz-from-path" data-source-name="${escapeHTML(sourceName)}">
              🎮 Generate Quiz
            </button>
            <button class="btn btn-secondary" id="finishPathBtn">
              ✓ Back to My Lessons
            </button>
          </div>
          <div class="completion-stats">
            <div class="stat-item">
              <span class="stat-value">${totalUnits}</span>
              <span class="stat-label">Units Completed</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${completedUnits}</span>
              <span class="stat-label">Units Mastered</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">100%</span>
              <span class="stat-label">Progress</span>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

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

  // Completion banner event listeners
  if (allCompleted) {
    const finishBtn = container.querySelector('#finishPathBtn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        console.log('Finish button clicked - navigating to lessons page');
        // Navigate with hash to show My Lessons with paths tab
        window.location.href = '/lessons#my-lessons-paths';
      });
    }

    const generateQuizBtn = container.querySelector('.generate-quiz-from-path');
    if (generateQuizBtn) {
      generateQuizBtn.addEventListener('click', () => {
        try {
          console.log('Generate Quiz clicked - preparing content');
          
          // Combine all unit content (strip HTML/markup for cleaner quiz generation)
          const combinedContent = path.map(p => {
            // Remove HTML tags and formula markers for cleaner content
            let content = p.learning_unit.content || '';
            content = content.replace(/\[FORMULA\].*?\[\/FORMULA\]/g, ''); // Remove formulas
            content = content.replace(/\[EXAMPLE\]|\[\/EXAMPLE\]/g, '');
            content = content.replace(/\[TIP\]|\[\/TIP\]/g, '');
            content = content.replace(/\[WARNING\]|\[\/WARNING\]/g, '');
            content = content.replace(/\[HIGHLIGHT\]|\[\/HIGHLIGHT\]/g, '');
            content = content.replace(/<[^>]*>/g, ''); // Remove any HTML
            return `${p.learning_unit.title}\n\n${content}`;
          }).join('\n\n---\n\n');
          
          console.log('Content prepared, length:', combinedContent.length);
          
          // Create a Blob from the content
          const blob = new Blob([combinedContent], { type: 'text/plain' });
          const file = new File([blob], `${sourceName}.txt`, { type: 'text/plain' });
          
          // Store file and metadata in sessionStorage
          const reader = new FileReader();
          reader.onload = function(e) {
            sessionStorage.setItem('preloadedFile', e.target.result);
            sessionStorage.setItem('preloadedFileName', `${sourceName}.txt`);
            sessionStorage.setItem('preloadedFileType', 'text/plain');
            
            console.log('File stored in sessionStorage, redirecting to /create');
            
            // Redirect to create page
            window.location.href = '/create#quiz-from-path';
          };
          reader.readAsDataURL(blob);
          
        } catch (error) {
          console.error('Error preparing quiz:', error);
          if (typeof window.showToast === 'function') {
            window.showToast('Failed to prepare quiz. Please try again.', 'error');
          }
        }
      });
    }
  }
}

// Remove duplicate escapeHTML - already defined at line 219

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
      <div style="padding:20px 40px;background:var(--paper-2);border-top:4px solid var(--text);
        display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;flex-shrink:0;">
        <div style="flex:1;min-width:200px;">
          ${pathItem.status === 'completed' ? `
            <button id="reviewUnitBtn" class="btn btn-secondary" style="padding:12px 20px;font-size:13px;font-weight:700;">
              🔄 Review This Unit
            </button>
          ` : `
            <p style="margin:0;font-size:12px;color:var(--muted);line-height:1.4;">
              💡 Complete this unit to unlock the next one
            </p>
          `}
          <p style="margin:6px 0 0;font-size:11px;color:var(--muted);">
            💡 Tip: Select text to highlight it
          </p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          ${pathItem.status !== 'completed' ? `
            <button id="markCompleteBtn" class="btn" style="padding:14px 28px;font-size:15px;font-weight:900;">
              ✅ Mark Complete
            </button>
          ` : `
            <div style="padding:12px 24px;background:#10b981;color:white;font-weight:900;
              border-radius:10px;border:3px solid #059669;font-size:14px;">
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
  
  // Initialize highlighting after a brief delay for DOM to be ready
  setTimeout(() => {
    const contentDiv = document.getElementById('unitContent');
    if (contentDiv) {
      initHighlighting(unit.id, userId, contentDiv);
    }
  }, 500);

  // Close modal
  modal.querySelector('#closeUnitModal').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Mark complete (use once flag to prevent double-click)
  const markCompleteBtn = modal.querySelector('#markCompleteBtn');
  if (markCompleteBtn) {
    let isProcessing = false;
    
    markCompleteBtn.addEventListener('click', async () => {
      if (isProcessing) return; // Prevent double-click
      isProcessing = true;
      
      markCompleteBtn.disabled = true;
      markCompleteBtn.textContent = 'Saving...';
      
      try {
        const result = await updateUnitProgress(userId, unit.id, 100, true);
        if (result.success) {
          // Close modal immediately
          modal.remove();
          
          // Show success toast
          if (window.showToast) {
            window.showToast('Unit completed! 🎉', 'success');
          }
          
          // Wait a bit then refresh path (prevents duplicate render)
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Refresh ONLY the learning path container if it exists
          const pathContainer = document.getElementById('learningPathContainer');
          if (pathContainer && window.getLearningPath && window.renderLearningPath) {
            const pathData = await window.getLearningPath(userId);
            window.renderLearningPath(pathContainer, pathData, userId);
          }
        } else {
          markCompleteBtn.disabled = false;
          markCompleteBtn.textContent = '✅ Mark Complete';
          isProcessing = false;
          alert('Failed to save progress. Please try again.');
        }
      } catch (error) {
        console.error('Mark complete error:', error);
        markCompleteBtn.disabled = false;
        markCompleteBtn.textContent = '✅ Mark Complete';
        isProcessing = false;
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
  
  // Process interactive markers FIRST (before escaping)
  let html = content;
  
  // Extract formulas and replace with placeholders
  formulas.forEach((f, i) => {
    html = html.replace(f.original, `__FORMULA_${i}__`);
  });
  
  // Extract interactive boxes BEFORE escaping
  const interactiveBoxes = [];
  
  html = html.replace(/\[EXAMPLE\](.*?)\[\/EXAMPLE\]/gs, (match, text) => {
    const index = interactiveBoxes.length;
    interactiveBoxes.push({
      type: 'example',
      content: text
    });
    return `__INTERACTIVE_${index}__`;
  });
  
  html = html.replace(/\[TIP\](.*?)\[\/TIP\]/gs, (match, text) => {
    const index = interactiveBoxes.length;
    interactiveBoxes.push({
      type: 'tip',
      content: text
    });
    return `__INTERACTIVE_${index}__`;
  });
  
  html = html.replace(/\[WARNING\](.*?)\[\/WARNING\]/gs, (match, text) => {
    const index = interactiveBoxes.length;
    interactiveBoxes.push({
      type: 'warning',
      content: text
    });
    return `__INTERACTIVE_${index}__`;
  });
  
  html = html.replace(/\[HIGHLIGHT\](.*?)\[\/HIGHLIGHT\]/g, (match, text) => {
    const index = interactiveBoxes.length;
    interactiveBoxes.push({
      type: 'highlight',
      content: text
    });
    return `__INTERACTIVE_${index}__`;
  });
  
  // Process section headers with emojis BEFORE escaping
  html = html.replace(/^📝\s*\*\*Overview\*\*/gm, '__SECTION_OVERVIEW__');
  html = html.replace(/^🎯\s*\*\*Key Concepts?\*\*/gm, '__SECTION_CONCEPTS__');
  html = html.replace(/^📚\s*\*\*Detailed Explanation\*\*/gm, '__SECTION_EXPLANATION__');
  html = html.replace(/^💡\s*\*\*Pro Tips?.*?\*\*/gm, '__SECTION_TIPS__');
  html = html.replace(/^⚠️\s*\*\*Common Mistakes?.*?\*\*/gm, '__SECTION_MISTAKES__');
  html = html.replace(/^🔍\s*\*\*Self-Check.*?\*\*/gm, '__SECTION_QUESTIONS__');
  
  // NOW escape HTML (plain text only)
  html = escapeHTML(html);
  
  // Restore section headers
  html = html.replace(/__SECTION_OVERVIEW__/g, '<h3 class="section-header">📝 Overview</h3>');
  html = html.replace(/__SECTION_CONCEPTS__/g, '<h3 class="section-header">🎯 Key Concepts</h3>');
  html = html.replace(/__SECTION_EXPLANATION__/g, '<h3 class="section-header">📚 Detailed Explanation</h3>');
  html = html.replace(/__SECTION_TIPS__/g, '<h3 class="section-header">💡 Pro Tips</h3>');
  html = html.replace(/__SECTION_MISTAKES__/g, '<h3 class="section-header">⚠️ Common Mistakes</h3>');
  html = html.replace(/__SECTION_QUESTIONS__/g, '<h3 class="section-header">🔍 Self-Check Questions</h3>');
  
  // Restore formulas
  formulas.forEach((f, i) => {
    html = html.replace(`__FORMULA_${i}__`, `<span class="formula-inline" data-formula="${escapeHTML(f.fixed)}"></span>`);
  });
  
  // Restore interactive boxes
  interactiveBoxes.forEach((box, i) => {
    let boxHtml = '';
    switch(box.type) {
      case 'example':
        boxHtml = `<div class="example-box">💡 <strong>Example:</strong><br>${box.content}</div>`;
        break;
      case 'tip':
        boxHtml = `<div class="tip-box">💡 <strong>Tip:</strong> ${box.content}</div>`;
        break;
      case 'warning':
        boxHtml = `<div class="warning-box">⚠️ <strong>Warning:</strong> ${box.content}</div>`;
        break;
      case 'highlight':
        boxHtml = `<mark class="highlight-text">${box.content}</mark>`;
        break;
    }
    html = html.replace(`__INTERACTIVE_${i}__`, boxHtml);
  });
  
  // Process markdown-style formatting
  html = html
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Convert bullet points
  html = html.replace(/^- (.+?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\s*)+/gs, '<ul>$&</ul>');
  
  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim());
  html = paragraphs.map(p => {
    // Check if already wrapped in div/h3/ul (from replacements above)
    if (p.trim().match(/^<(div|h3|ul|mark)/)) return p;
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
    position:fixed;inset:0;background:rgba(0,0,0,0.94);z-index:10000;
    display:grid;place-items:center;padding:20px;
    backdrop-filter:blur(12px);
    animation: fadeIn 0.4s ease;`;
  
  modal.innerHTML = `
    <div style="max-width:600px;width:100%;background:var(--paper);
      border:4px solid var(--text);border-radius:20px;
      box-shadow:16px 16px 0 rgba(0,0,0,0.3);padding:48px 40px;
      position:relative;overflow:hidden;">
      
      <!-- Animated gradient background -->
      <div style="position:absolute;inset:0;
        background:linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
        opacity:0.6;pointer-events:none;"></div>
      
      <!-- Content wrapper -->
      <div style="position:relative;z-index:1;">
        
        <!-- Animated brain with rotating rings -->
        <div style="display:flex;justify-content:center;margin-bottom:32px;">
          <div style="position:relative;display:inline-block;">
            <div style="position:absolute;inset:-24px;
              border:5px solid transparent;border-radius:50%;
              border-top-color:var(--accent);border-right-color:var(--accent);
              animation:spin 3s linear infinite;opacity:0.6;"></div>
            <div style="position:absolute;inset:-12px;
              border:4px solid transparent;border-radius:50%;
              border-bottom-color:var(--blue);border-left-color:var(--blue);
              animation:spinReverse 2s linear infinite;opacity:0.4;"></div>
            <div style="font-size:80px;animation:pulse 2.5s ease-in-out infinite;">🧠</div>
          </div>
        </div>
        
        <h2 style="margin:0 0 8px;font-size:28px;font-weight:900;
          text-align:center;letter-spacing:-0.02em;">AI Learning Assistant</h2>
        <p style="margin:0 0 36px;font-size:15px;color:var(--muted);text-align:center;">
          Creating your personalized learning path
        </p>
        
        <div id="processingSteps" style="margin:0 0 32px;">
          <div class="process-step active-step" data-step="1" style="display:flex;align-items:center;gap:14px;
            padding:16px;border-radius:12px;margin-bottom:10px;
            background:linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05));
            border:3px solid var(--accent);animation:slideIn 0.3s ease;">
            <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--accent);
              color:white;display:grid;place-items:center;font-weight:900;font-size:14px;
              box-shadow:0 4px 8px rgba(168, 85, 247, 0.3);">1</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:900;font-size:15px;margin-bottom:4px;">Analyzing Document</div>
              <div class="step-status" style="font-size:13px;color:var(--muted);">
                Reading and understanding your material...
              </div>
            </div>
            <div class="step-spinner" style="flex-shrink:0;width:24px;height:24px;
              border:4px solid rgba(168, 85, 247, 0.2);border-top-color:var(--accent);
              border-radius:50%;animation:spin 1s linear infinite;"></div>
          </div>
          
          <div class="process-step" data-step="2" style="display:flex;align-items:center;gap:14px;
            padding:16px;border-radius:12px;margin-bottom:10px;opacity:0.5;
            background:rgba(0,0,0,0.05);border:3px solid var(--paper-2);">
            <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--muted);
              color:white;display:grid;place-items:center;font-weight:900;font-size:14px;">2</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:900;font-size:15px;margin-bottom:4px;">Creating Learning Units</div>
              <div class="step-status" style="font-size:13px;color:var(--muted);">Waiting...</div>
            </div>
          </div>
          
          <div class="process-step" data-step="3" style="display:flex;align-items:center;gap:14px;
            padding:16px;border-radius:12px;opacity:0.5;
            background:rgba(0,0,0,0.05);border:3px solid var(--paper-2);">
            <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--muted);
              color:white;display:grid;place-items:center;font-weight:900;font-size:14px;">3</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:900;font-size:15px;margin-bottom:4px;">Extracting Concepts</div>
              <div class="step-status" style="font-size:13px;color:var(--muted);">Waiting...</div>
            </div>
          </div>
        </div>
        
        <div style="margin:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:900;text-transform:uppercase;
              letter-spacing:0.08em;color:var(--muted);">Overall Progress</span>
            <span id="processingPercent" style="font-size:15px;font-weight:900;color:var(--accent);">0%</span>
          </div>
          <div style="height:12px;background:rgba(0,0,0,0.1);border-radius:20px;
            border:3px solid var(--text);overflow:hidden;position:relative;">
            <div id="processingProgress" style="height:100%;
              background:linear-gradient(90deg, var(--accent), var(--blue));
              width:0%;transition:width 0.6s ease;
              box-shadow:0 0 16px rgba(168, 85, 247, 0.6);position:relative;overflow:hidden;">
              <div style="position:absolute;inset:0;
                background:linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                animation:shine 2s infinite;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes spinReverse { to { transform: rotate(-360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(modal);
  return modal;
}

function updateProcessingStep(stepNumber) {
  const steps = document.querySelectorAll('.process-step');
  const progress = document.querySelector('#processingProgress');
  const percent = document.querySelector('#processingPercent');
  
  const stepData = [
    { title: 'Analyzing Document', status: 'Reading and understanding your material...',  percent: 33 },
    { title: 'Creating Learning Units', status: 'Breaking down into digestible chunks...', percent: 66 },
    { title: 'Extracting Concepts', status: 'Building knowledge graph...', percent: 100 }
  ];
  
  steps.forEach((step, i) => {
    const stepNum = i + 1;
    const stepIcon = step.querySelector('[style*="width:32px"]');
    const stepStatus = step.querySelector('.step-status');
    const spinner = step.querySelector('.step-spinner');
    
    if (stepNum < stepNumber) {
      // Completed step
      step.style.opacity = '1';
      step.style.background = 'rgba(16, 185, 129, 0.1)';
      step.style.border = '3px solid #10b981';
      stepIcon.style.background = '#10b981';
      stepIcon.textContent = '✓';
      if (stepStatus) stepStatus.textContent = 'Complete!';
      if (spinner) spinner.remove();
    } else if (stepNum === stepNumber) {
      // Current step
      step.style.opacity = '1';
      step.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05))';
      step.style.border = '3px solid var(--accent)';
      step.classList.add('active-step');
      stepIcon.style.background = 'var(--accent)';
      if (stepStatus && stepData[i]) stepStatus.textContent = stepData[i].status;
    } else {
      // Future step
      step.style.opacity = '0.5';
    }
  });
  
  // Update progress
  if (progress && stepData[stepNumber - 1]) {
    progress.style.width = `${stepData[stepNumber - 1].percent}%`;
    if (percent) percent.textContent = `${stepData[stepNumber - 1].percent}%`;
  }
}

function closeProcessingModal() {
  const modal = document.querySelector('#processingModal');
  if (modal) modal.remove();
}
