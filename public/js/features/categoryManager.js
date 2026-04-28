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

export async function showCategoryManagerModal(userId, onUpdate) {
  const categories = await getCategories(userId);

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:600px;">
      <div class="modal-header">
        <h2 class="modal-title">Manage Categories</h2>
        <button class="modal-close" id="closeCategoryModal">✕</button>
      </div>
      
      <div class="modal-body" style="max-height:400px;overflow-y:auto;">
        <div id="categoriesList" class="flex flex-col gap-2">
          ${renderCategoriesList(categories)}
        </div>
      </div>

      <div class="modal-footer">
        <button id="addCategoryBtn" class="btn btn-sm">+ Add Category</button>
        <button id="closeCategoryModalBtn" class="btn btn-secondary btn-sm">Done</button>
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
    const name = prompt("Category name:");
    if (!name) return;

    const newCategory = await createCategory(userId, name);
    if (newCategory) {
      categories.push(newCategory);
      modal.querySelector("#categoriesList").innerHTML = renderCategoriesList(categories);
    }
  };

  // Delete handlers
  modal.querySelectorAll("[data-delete-category]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.deleteCategory;
      if (!confirm("Delete this category? Lessons will be moved to 'Uncategorized'.")) return;
      
      const success = await deleteCategory(id, userId);
      if (success) {
        const index = categories.findIndex(c => c.id === id);
        if (index > -1) categories.splice(index, 1);
        modal.querySelector("#categoriesList").innerHTML = renderCategoriesList(categories);
      }
    };
  });
}

function renderCategoriesList(categories) {
  if (!categories.length) {
    return `<div class="empty-state" style="padding:var(--space-8);">
      <div class="empty-state-icon">📚</div>
      <p class="empty-state-title">No categories yet</p>
      <p class="empty-state-description">Create categories to organize your lessons</p>
    </div>`;
  }

  return categories.map(cat => `
    <div class="flat-card flex items-center justify-between" style="padding:var(--space-3);">
      <div class="flex items-center gap-3">
        <span style="font-size:24px;">${cat.icon}</span>
        <div>
          <div class="font-bold">${escapeHTML(cat.name)}</div>
          <div class="text-xs text-muted">${cat.color}</div>
        </div>
      </div>
      <button class="btn btn-danger btn-sm" data-delete-category="${cat.id}">Delete</button>
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
