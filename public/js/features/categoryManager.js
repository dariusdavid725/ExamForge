// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY MANAGER — Organize lessons like ChatGPT projects
// ═══════════════════════════════════════════════════════════════════════════

import { showToast } from "../shared/uiFeedback.js";

// ─── API ───────────────────────────────────────────────────────────────────────

export async function getCategories(userId) {
  try {
    const res = await fetch(`/api/categories?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to load categories");
    return await res.json();
  } catch (err) {
    console.error("Get categories error:", err);
    return [];
  }
}

export async function createCategory(userId, name, color = "#4f46e5", icon = "📚") {
  try {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, color, icon })
    });
    if (!res.ok) throw new Error("Failed to create category");
    const data = await res.json();
    showToast(`Category "${name}" created!`, "success");
    return data;
  } catch (err) {
    console.error("Create category error:", err);
    showToast(err.message, "danger");
    return null;
  }
}

export async function updateCategory(id, userId, updates) {
  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...updates })
    });
    if (!res.ok) throw new Error("Failed to update category");
    return await res.json();
  } catch (err) {
    console.error("Update category error:", err);
    showToast(err.message, "danger");
    return null;
  }
}

export async function deleteCategory(id, userId) {
  try {
    const res = await fetch(`/api/categories/${id}?userId=${userId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete category");
    showToast("Category deleted", "success");
    return true;
  } catch (err) {
    console.error("Delete category error:", err);
    showToast(err.message, "danger");
    return false;
  }
}

// ─── UI: Category Manager Modal ────────────────────────────────────────────────

// ─── Input Modal ────────────────────────────────────────────────────────────

export function showInputModal(title, label, onSubmit) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:400px;">
      <div class="modal-header">
        <h2 class="modal-title">${escapeHTML(title)}</h2>
        <button class="modal-close" id="closeInputModal">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">${escapeHTML(label)}</label>
          <input type="text" class="input" id="inputModalValue" autofocus />
        </div>
      </div>

      <div class="modal-footer">
        <button id="inputModalCancel" class="btn btn-secondary">Cancel</button>
        <button id="inputModalSubmit" class="btn">Submit</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = modal.querySelector("#inputModalValue");
  const submitBtn = modal.querySelector("#inputModalSubmit");
  const cancelBtn = modal.querySelector("#inputModalCancel");
  const closeBtn = modal.querySelector("#closeInputModal");

  const close = () => document.body.removeChild(modal);

  submitBtn.onclick = () => {
    const value = input.value.trim();
    close();
    if (onSubmit) onSubmit(value);
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      const value = input.value.trim();
      close();
      if (onSubmit) onSubmit(value);
    }
  };

  cancelBtn.onclick = close;
  closeBtn.onclick = close;
  input.focus();
}

// ─── Confirm Modal ──────────────────────────────────────────────────────────

export function showConfirmModal(title, message, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:400px;">
      <div class="modal-header">
        <h2 class="modal-title">${escapeHTML(title)}</h2>
        <button class="modal-close" id="closeConfirmModal">✕</button>
      </div>
      
      <div class="modal-body">
        <p>${escapeHTML(message)}</p>
      </div>

      <div class="modal-footer">
        <button id="confirmModalCancel" class="btn btn-secondary">Cancel</button>
        <button id="confirmModalConfirm" class="btn btn-danger">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => document.body.removeChild(modal);

  modal.querySelector("#confirmModalConfirm").onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };

  modal.querySelector("#confirmModalCancel").onclick = close;
  modal.querySelector("#closeConfirmModal").onclick = close;
}

export async function showCategoryManagerModal(userId, onUpdate) {
  const categories = await getCategories(userId);

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:600px;max-height:80vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <h2 class="modal-title">Manage Categories</h2>
        <button class="modal-close" id="closeCategoryModal">✕</button>
      </div>
      
      <div class="modal-body" style="flex:1;overflow-y:auto;padding:var(--space-6);">
        <div id="categoriesList" style="display:grid;gap:var(--space-3);">
          ${renderCategoriesList(categories)}
        </div>
      </div>

      <div class="modal-footer" style="border-top:1px solid var(--paper-2);padding:var(--space-4);">
        <button id="addCategoryBtn" class="btn">+ Add Category</button>
        <button id="closeCategoryModalBtn" class="btn btn-secondary">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event handlers
  modal.querySelector("#closeCategoryModal").onclick = () => {
    document.body.removeChild(modal);
    if (onUpdate) onUpdate();
  };
  
  modal.querySelector("#closeCategoryModalBtn").onclick = () => {
    document.body.removeChild(modal);
    if (onUpdate) onUpdate();
  };

  modal.querySelector("#addCategoryBtn").onclick = async () => {
    showInputModal("New Category", "Category name:", async (name) => {
      if (!name) return;
      const newCategory = await createCategory(userId, name);
      if (newCategory) {
        categories.push(newCategory);
        modal.querySelector("#categoriesList").innerHTML = renderCategoriesList(categories);
        attachDeleteHandlers();
      }
    });
  };

  function attachDeleteHandlers() {
    modal.querySelectorAll("[data-delete-category]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.deleteCategory;
        showConfirmModal(
          "Delete Category",
          "This will unlink all lessons from this category. Are you sure?",
          async () => {
            const success = await deleteCategory(id, userId);
            if (success) {
              const index = categories.findIndex(c => c.id === id);
              if (index > -1) categories.splice(index, 1);
              modal.querySelector("#categoriesList").innerHTML = renderCategoriesList(categories);
              attachDeleteHandlers();
            }
          }
        );
      };
    });
  }

  attachDeleteHandlers();

}

function renderCategoriesList(categories) {
  if (!categories.length) {
    return `
      <div style="text-align:center;padding:var(--space-12) var(--space-4);">
        <div style="font-size:48px;opacity:0.3;margin-bottom:var(--space-4);">●</div>
        <h3 style="font-size:var(--text-lg);font-weight:700;margin:0 0 var(--space-2);">No categories yet</h3>
        <p style="font-size:var(--text-sm);color:var(--muted);">Create categories to organize your lessons</p>
      </div>`;
  }

  return categories.map(cat => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-4);
                background:white;border:1px solid var(--paper-2);border-radius:var(--radius-md);">
      <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:0;">
        <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;
                    background:var(--paper-2);border-radius:var(--radius-sm);font-size:16px;flex-shrink:0;">
          ${cat.icon}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:var(--text-base);">${escapeHTML(cat.name)}</div>
          <div style="font-size:var(--text-xs);color:var(--muted);margin-top:2px;">${cat.color}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" data-delete-category="${cat.id}" style="color:var(--red);">
        Delete
      </button>
    </div>
  `).join("");
}

// ─── UI: Category Selector (for moving lessons) ────────────────────────────────

export async function showCategorySelector(userId, currentCategoryId, onSelect) {
  const categories = await getCategories(userId);

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:400px;">
      <div class="modal-header">
        <h2 class="modal-title">Move to Category</h2>
        <button class="modal-close" id="closeCatSelector">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="flex flex-col gap-2">
          ${categories.map(cat => `
            <button class="btn btn-secondary w-full text-left flex items-center gap-3" 
                    data-category-id="${cat.id}"
                    style="justify-content:flex-start;">
              <span style="font-size:20px;">${cat.icon}</span>
              <span>${escapeHTML(cat.name)}</span>
              ${cat.id === currentCategoryId ? '<span class="ml-auto">✓</span>' : ''}
            </button>
          `).join("")}
          
          <button class="btn btn-ghost w-full" data-category-id="null">
            📂 Uncategorized
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#closeCatSelector").onclick = () => {
    document.body.removeChild(modal);
  };

  modal.querySelectorAll("[data-category-id]").forEach(btn => {
    btn.onclick = () => {
      const categoryId = btn.dataset.categoryId === "null" ? null : btn.dataset.categoryId;
      document.body.removeChild(modal);
      if (onSelect) onSelect(categoryId);
    };
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
