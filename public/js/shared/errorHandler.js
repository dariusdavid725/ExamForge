// ══════════════════════════════════════════════════════════════════════════════
// BETTER ERROR HANDLING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Show contextual error with retry option
 */
export function showError(error, options = {}) {
  const {
    title = "Something went wrong",
    action = null,
    actionLabel = "Try again",
    onRetry = null
  } = options;

  const container = document.createElement("div");
  container.className = "error-state";
  container.style.cssText = "animation: slideIn 0.3s ease;";
  
  const isNetworkError = error?.message?.toLowerCase().includes("fetch") || 
                         error?.message?.toLowerCase().includes("network");
  
  const isRateLimit = error?.message?.toLowerCase().includes("rate limit") ||
                      error?.message?.toLowerCase().includes("429");

  let message = error?.message || "An unexpected error occurred.";
  let icon = "❌";
  let suggestions = [];

  if (isNetworkError) {
    icon = "📡";
    message = "Connection problem. Check your internet and try again.";
    suggestions = ["Check your internet connection", "Try refreshing the page"];
  } else if (isRateLimit) {
    icon = "⏱️";
    message = "Too many requests. Please wait a moment and try again.";
    suggestions = ["Wait 30 seconds", "Try again later"];
  } else if (error?.status === 403) {
    icon = "🔒";
    message = "You don't have permission to do this.";
  } else if (error?.status === 404) {
    icon = "🔍";
    message = "Resource not found. It may have been deleted.";
  } else if (error?.status === 500) {
    icon = "⚠️";
    message = "Server error. Our team has been notified.";
    suggestions = ["Try again in a few minutes"];
  }

  container.innerHTML = `
    <div class="state-icon">${icon}</div>
    <div class="state-content">
      <div class="state-title">${title}</div>
      <p class="state-message">${message}</p>
      ${suggestions.length > 0 ? `
        <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 13px; color: var(--muted);">
          ${suggestions.map(s => `<li>${s}</li>`).join("")}
        </ul>
      ` : ""}
      <div class="state-actions">
        ${onRetry ? `<button class="btn btn-secondary" id="errorRetryBtn">${actionLabel}</button>` : ""}
        ${action ? `<button class="btn" id="errorActionBtn">${action.label}</button>` : ""}
        <button class="btn btn-secondary" id="errorDismissBtn">Dismiss</button>
      </div>
    </div>
  `;

  // Insert at top of main or body
  const target = document.querySelector("main") || document.body;
  target.insertBefore(container, target.firstChild);

  // Event listeners
  const retryBtn = container.querySelector("#errorRetryBtn");
  const actionBtn = container.querySelector("#errorActionBtn");
  const dismissBtn = container.querySelector("#errorDismissBtn");

  if (retryBtn && onRetry) {
    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = "Retrying...";
      try {
        await onRetry();
        container.remove();
      } catch (err) {
        retryBtn.disabled = false;
        retryBtn.textContent = actionLabel;
        showError(err, options);
      }
    });
  }

  if (actionBtn && action?.onClick) {
    actionBtn.addEventListener("click", () => {
      action.onClick();
      container.remove();
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      container.style.animation = "slideOut 0.3s ease";
      setTimeout(() => container.remove(), 300);
    });
  }

  // Auto-dismiss after 10s
  setTimeout(() => {
    if (container.parentElement) {
      container.style.animation = "slideOut 0.3s ease";
      setTimeout(() => container.remove(), 300);
    }
  }, 10000);

  return container;
}

/**
 * Show success message
 */
export function showSuccess(message, options = {}) {
  const {
    title = "Success!",
    duration = 5000
  } = options;

  const container = document.createElement("div");
  container.className = "success-state";
  container.style.cssText = "animation: slideIn 0.3s ease;";

  container.innerHTML = `
    <div class="state-icon">✓</div>
    <div class="state-content">
      <div class="state-title">${title}</div>
      <p class="state-message">${message}</p>
    </div>
  `;

  const target = document.querySelector("main") || document.body;
  target.insertBefore(container, target.firstChild);

  setTimeout(() => {
    container.style.animation = "slideOut 0.3s ease";
    setTimeout(() => container.remove(), 300);
  }, duration);

  return container;
}

/**
 * Show info message
 */
export function showInfo(message, options = {}) {
  const {
    title = "Info",
    duration = 5000
  } = options;

  const container = document.createElement("div");
  container.className = "info-state";
  container.style.cssText = "animation: slideIn 0.3s ease;";

  container.innerHTML = `
    <div class="state-icon">ℹ️</div>
    <div class="state-content">
      <div class="state-title">${title}</div>
      <p class="state-message">${message}</p>
    </div>
  `;

  const target = document.querySelector("main") || document.body;
  target.insertBefore(container, target.firstChild);

  setTimeout(() => {
    container.style.animation = "slideOut 0.3s ease";
    setTimeout(() => container.remove(), 300);
  }, duration);

  return container;
}

// Add animation keyframes
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-20px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
