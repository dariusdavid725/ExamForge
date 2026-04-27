/**
 * Unified Loading Manager
 * Consistent loading states across the entire app
 */

let currentLoadingModal = null;

/**
 * Show unified loading modal with steps
 */
export function showLoading(title = "Processing", steps = []) {
  // Remove any existing loading
  hideLoading();
  
  const modal = document.createElement('div');
  modal.id = 'unifiedLoadingModal';
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
      
      <div style="position:absolute;inset:0;
        background:linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
        opacity:0.6;pointer-events:none;"></div>
      
      <div style="position:relative;z-index:1;">
        
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
            <div id="loadingIcon" style="font-size:80px;animation:pulse 2.5s ease-in-out infinite;">🧠</div>
          </div>
        </div>
        
        <h2 id="loadingTitle" style="margin:0 0 8px;font-size:28px;font-weight:900;
          text-align:center;letter-spacing:-0.02em;">${title}</h2>
        <p id="loadingSubtitle" style="margin:0 0 36px;font-size:15px;color:var(--muted);text-align:center;">
          Processing your request...
        </p>
        
        <div id="loadingSteps" style="margin:0 0 32px;">
          ${steps.map((step, i) => `
            <div class="loading-step" data-step="${i + 1}" style="display:flex;align-items:center;gap:14px;
              padding:16px;border-radius:12px;margin-bottom:10px;opacity:${i === 0 ? '1' : '0.5'};
              background:${i === 0 ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05))' : 'rgba(0,0,0,0.05)'};
              border:3px solid ${i === 0 ? 'var(--accent)' : 'var(--paper-2)'};
              animation:${i === 0 ? 'slideIn 0.3s ease' : 'none'};">
              <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;
                background:${i === 0 ? 'var(--accent)' : 'var(--muted)'};color:white;
                display:grid;place-items:center;font-weight:900;font-size:14px;
                box-shadow:${i === 0 ? '0 4px 8px rgba(168, 85, 247, 0.3)' : 'none'};">${i + 1}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:900;font-size:15px;margin-bottom:4px;">${step}</div>
                <div class="step-status" style="font-size:13px;color:var(--muted);">
                  ${i === 0 ? 'Processing...' : 'Waiting...'}
                </div>
              </div>
              ${i === 0 ? `
                <div class="step-spinner" style="flex-shrink:0;width:24px;height:24px;
                  border:4px solid rgba(168, 85, 247, 0.2);border-top-color:var(--accent);
                  border-radius:50%;animation:spin 1s linear infinite;"></div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        
        <div style="margin:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:900;text-transform:uppercase;
              letter-spacing:0.08em;color:var(--muted);">Overall Progress</span>
            <span id="loadingPercent" style="font-size:15px;font-weight:900;color:var(--accent);">0%</span>
          </div>
          <div style="height:12px;background:rgba(0,0,0,0.1);border-radius:20px;
            border:3px solid var(--text);overflow:hidden;position:relative;">
            <div id="loadingProgress" style="height:100%;
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
  
  if (!document.getElementById('loadingAnimations')) {
    const style = document.createElement('style');
    style.id = 'loadingAnimations';
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes spinReverse { to { transform: rotate(-360deg); } }
      @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(modal);
  currentLoadingModal = modal;
  
  return modal;
}

/**
 * Update loading step and progress
 */
export function updateLoadingStep(stepNumber, customMessage = null) {
  if (!currentLoadingModal) return;
  
  const steps = currentLoadingModal.querySelectorAll('.loading-step');
  const progress = currentLoadingModal.querySelector('#loadingProgress');
  const percent = currentLoadingModal.querySelector('#loadingPercent');
  
  const totalSteps = steps.length;
  const progressPercent = Math.round((stepNumber / totalSteps) * 100);
  
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
      stepIcon.style.background = 'var(--accent)';
      stepIcon.textContent = stepNum;
      if (stepStatus) stepStatus.textContent = customMessage || 'Processing...';
      
      // Add spinner if not present
      if (!spinner) {
        const newSpinner = document.createElement('div');
        newSpinner.className = 'step-spinner';
        newSpinner.style.cssText = `flex-shrink:0;width:24px;height:24px;
          border:4px solid rgba(168, 85, 247, 0.2);border-top-color:var(--accent);
          border-radius:50%;animation:spin 1s linear infinite;`;
        step.appendChild(newSpinner);
      }
    } else {
      // Future step
      step.style.opacity = '0.5';
    }
  });
  
  if (progress) {
    progress.style.width = `${progressPercent}%`;
  }
  if (percent) {
    percent.textContent = `${progressPercent}%`;
  }
}

/**
 * Update loading message
 */
export function updateLoadingMessage(title, subtitle) {
  if (!currentLoadingModal) return;
  
  const titleEl = currentLoadingModal.querySelector('#loadingTitle');
  const subtitleEl = currentLoadingModal.querySelector('#loadingSubtitle');
  
  if (titleEl && title) titleEl.textContent = title;
  if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;
}

/**
 * Hide loading modal
 */
export function hideLoading() {
  if (currentLoadingModal) {
    currentLoadingModal.remove();
    currentLoadingModal = null;
  }
  
  // Also remove old modals if any
  document.querySelectorAll('#unifiedLoadingModal, #processingModal').forEach(m => m.remove());
}

/**
 * Show success state briefly before hiding
 */
export async function showLoadingSuccess(message = "Complete!", duration = 600) {
  if (!currentLoadingModal) return;
  
  updateLoadingMessage("Success!", message);
  updateLoadingStep(999); // Mark all as complete
  
  const progress = currentLoadingModal.querySelector('#loadingProgress');
  const percent = currentLoadingModal.querySelector('#loadingPercent');
  const icon = currentLoadingModal.querySelector('#loadingIcon');
  
  if (progress) progress.style.width = '100%';
  if (percent) percent.textContent = '100%';
  if (icon) icon.textContent = '✅';
  
  await new Promise(resolve => setTimeout(resolve, duration));
  hideLoading();
}
