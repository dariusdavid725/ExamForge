/**
 * Text Highlighting System for Learning Units
 * Allows users to highlight text, choose colors, and save to database
 */

let currentSelection = null;
let currentUnitId = null;
let currentUserId = null;
let highlights = [];

const COLORS = {
  yellow: { bg: '#fef08a', border: '#fbbf24', name: 'Yellow' },
  green: { bg: '#86efac', border: '#22c55e', name: 'Green' },
  blue: { bg: '#93c5fd', border: '#3b82f6', name: 'Blue' },
  pink: { bg: '#fbcfe8', border: '#ec4899', name: 'Pink' },
  purple: { bg: '#d8b4fe', border: '#a855f7', name: 'Purple' }
};

/**
 * Initialize highlighting for a learning unit
 */
export function initHighlighting(unitId, userId, contentElement) {
  currentUnitId = unitId;
  currentUserId = userId;
  
  // Load existing highlights
  loadHighlights();
  
  // Add selection listener
  contentElement.addEventListener('mouseup', handleTextSelection);
  
  // Add click listener to remove highlight menu
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.highlight-menu') && !e.target.closest('.highlighted-text')) {
      removeHighlightMenu();
    }
  });
}

/**
 * Handle text selection
 */
function handleTextSelection(e) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length < 3) {
    removeHighlightMenu();
    return;
  }
  
  // Get selection range
  const range = selection.getRangeAt(0);
  const contentElement = document.getElementById('unitContent');
  
  if (!contentElement || !contentElement.contains(range.commonAncestorContainer)) {
    return;
  }
  
  // Calculate offset from start of content
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(contentElement);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preSelectionRange.toString().length;
  const endOffset = startOffset + selectedText.length;
  
  currentSelection = {
    text: selectedText,
    startOffset,
    endOffset,
    range
  };
  
  // Show highlight menu
  showHighlightMenu(e.clientX, e.clientY);
}

/**
 * Show highlight color picker menu
 */
function showHighlightMenu(x, y) {
  removeHighlightMenu();
  
  const menu = document.createElement('div');
  menu.className = 'highlight-menu';
  menu.style.cssText = `
    position:fixed;
    left:${x}px;
    top:${y - 60}px;
    background:var(--paper);
    border:3px solid var(--text);
    border-radius:12px;
    box-shadow:8px 8px 0 rgba(0,0,0,0.2);
    padding:8px;
    display:flex;
    gap:6px;
    z-index:10001;
    animation:slideDown 0.2s ease;
  `;
  
  // Add color buttons
  Object.entries(COLORS).forEach(([colorKey, colorData]) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width:32px;
      height:32px;
      border-radius:6px;
      background:${colorData.bg};
      border:3px solid ${colorData.border};
      cursor:pointer;
      transition:transform 0.2s;
    `;
    btn.title = colorData.name;
    btn.addEventListener('click', () => createHighlight(colorKey));
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });
    menu.appendChild(btn);
  });
  
  document.body.appendChild(menu);
  
  // Add CSS animation
  if (!document.getElementById('highlightMenuStyle')) {
    const style = document.createElement('style');
    style.id = 'highlightMenuStyle';
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Remove highlight menu
 */
function removeHighlightMenu() {
  document.querySelectorAll('.highlight-menu').forEach(menu => menu.remove());
}

/**
 * Create a new highlight
 */
async function createHighlight(color) {
  if (!currentSelection) return;
  
  removeHighlightMenu();
  
  try {
    const response = await fetch('/api/highlights/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        unitId: currentUnitId,
        textContent: currentSelection.text,
        startOffset: currentSelection.startOffset,
        endOffset: currentSelection.endOffset,
        color
      })
    });
    
    if (!response.ok) throw new Error('Failed to create highlight');
    
    const data = await response.json();
    highlights.push(data.highlight);
    
    // Re-render all highlights
    renderHighlights();
    
    // Clear selection
    window.getSelection().removeAllRanges();
    currentSelection = null;
    
    if (window.showToast) {
      window.showToast('Highlighted!', 'success');
    }
  } catch (error) {
    console.error('Error creating highlight:', error);
    if (window.showToast) {
      window.showToast('Failed to save highlight', 'error');
    }
  }
}

/**
 * Load highlights from database
 */
async function loadHighlights() {
  try {
    const response = await fetch(`/api/highlights/${currentUnitId}/${currentUserId}`);
    if (!response.ok) throw new Error('Failed to load highlights');
    
    const data = await response.json();
    highlights = data.highlights || [];
    
    renderHighlights();
  } catch (error) {
    console.error('Error loading highlights:', error);
  }
}

/**
 * Render all highlights in the content
 */
function renderHighlights() {
  const contentElement = document.getElementById('unitContent');
  if (!contentElement) return;
  
  // Get original text content
  let textContent = contentElement.textContent;
  
  // Sort highlights by start offset (descending) to apply from end to start
  const sortedHighlights = [...highlights].sort((a, b) => b.start_offset - a.start_offset);
  
  // Create an array of text nodes to process
  const walker = document.createTreeWalker(
    contentElement,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let currentOffset = 0;
  let node;
  
  while (node = walker.nextNode()) {
    const nodeLength = node.textContent.length;
    textNodes.push({
      node,
      startOffset: currentOffset,
      endOffset: currentOffset + nodeLength
    });
    currentOffset += nodeLength;
  }
  
  // Apply highlights
  sortedHighlights.forEach(highlight => {
    const { start_offset, end_offset, color, id } = highlight;
    const colorData = COLORS[color] || COLORS.yellow;
    
    // Find text nodes that overlap with this highlight
    textNodes.forEach(({ node, startOffset, endOffset }) => {
      if (endOffset <= start_offset || startOffset >= end_offset) return;
      
      const highlightStart = Math.max(0, start_offset - startOffset);
      const highlightEnd = Math.min(node.textContent.length, end_offset - startOffset);
      
      if (highlightStart < highlightEnd) {
        // Split and wrap text
        const before = node.textContent.substring(0, highlightStart);
        const highlighted = node.textContent.substring(highlightStart, highlightEnd);
        const after = node.textContent.substring(highlightEnd);
        
        const span = document.createElement('span');
        span.className = 'highlighted-text';
        span.dataset.highlightId = id;
        span.style.cssText = `
          background:${colorData.bg};
          border-bottom:2px solid ${colorData.border};
          padding:2px 0;
          cursor:pointer;
          transition:all 0.2s;
        `;
        span.textContent = highlighted;
        
        // Add hover effect
        span.addEventListener('mouseenter', () => {
          span.style.background = colorData.border;
          span.style.transform = 'translateY(-1px)';
        });
        span.addEventListener('mouseleave', () => {
          span.style.background = colorData.bg;
          span.style.transform = 'translateY(0)';
        });
        
        // Add click to delete
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this highlight?')) {
            deleteHighlight(id);
          }
        });
        
        // Replace node
        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(span);
        if (after) fragment.appendChild(document.createTextNode(after));
        
        node.parentNode.replaceChild(fragment, node);
      }
    });
  });
}

/**
 * Delete a highlight
 */
async function deleteHighlight(highlightId) {
  try {
    const response = await fetch(`/api/highlights/${highlightId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete highlight');
    
    // Remove from local array
    highlights = highlights.filter(h => h.id !== highlightId);
    
    // Re-render
    renderHighlights();
    
    if (window.showToast) {
      window.showToast('Highlight removed', 'info');
    }
  } catch (error) {
    console.error('Error deleting highlight:', error);
    if (window.showToast) {
      window.showToast('Failed to delete highlight', 'error');
    }
  }
}

/**
 * Clear all highlights for current unit
 */
export async function clearAllHighlights() {
  if (!confirm(`Delete all ${highlights.length} highlights?`)) return;
  
  try {
    await Promise.all(highlights.map(h => 
      fetch(`/api/highlights/${h.id}`, { method: 'DELETE' })
    ));
    
    highlights = [];
    renderHighlights();
    
    if (window.showToast) {
      window.showToast('All highlights cleared', 'success');
    }
  } catch (error) {
    console.error('Error clearing highlights:', error);
  }
}
