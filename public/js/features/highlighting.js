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
  
  // Prevent default context menu on content
  contentElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  
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
  
  // Calculate offset from start of content (more robust)
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(contentElement);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  
  // Get actual text length (not node length)
  const precedingText = preSelectionRange.toString();
  const startOffset = precedingText.length;
  
  // Use selection's actual text length
  const actualSelectedText = range.toString();
  const endOffset = startOffset + actualSelectedText.length;
  
  // Validate selection
  if (endOffset <= startOffset || actualSelectedText.length < 3) {
    console.warn('Invalid selection:', { startOffset, endOffset, text: actualSelectedText });
    removeHighlightMenu();
    return;
  }
  
  currentSelection = {
    text: actualSelectedText,
    startOffset,
    endOffset,
    range
  };
  
  console.log('Selection:', { text: actualSelectedText.substring(0, 50), startOffset, endOffset });
  
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
 * SIMPLIFIED: Just wrap with spans, don't modify DOM too much
 */
function renderHighlights() {
  const contentElement = document.getElementById('unitContent');
  if (!contentElement) return;
  
  // Remove old highlights first
  contentElement.querySelectorAll('.highlighted-text').forEach(span => {
    const text = span.textContent;
    span.replaceWith(document.createTextNode(text));
  });
  
  if (highlights.length === 0) return;
  
  // Get all text content with positions
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
  
  // Sort highlights by start offset
  const sortedHighlights = [...highlights].sort((a, b) => a.start_offset - b.start_offset);
  
  // Apply highlights
  sortedHighlights.forEach(highlight => {
    const { start_offset, end_offset, color, id } = highlight;
    const colorData = COLORS[color] || COLORS.yellow;
    
    // Find the text node containing the start
    for (const { node, startOffset, endOffset } of textNodes) {
      if (start_offset >= startOffset && start_offset < endOffset) {
        // Calculate position within this node
        const localStart = start_offset - startOffset;
        const localEnd = Math.min(end_offset - startOffset, node.textContent.length);
        
        if (localStart < localEnd && node.parentNode) {
          const before = node.textContent.substring(0, localStart);
          const highlighted = node.textContent.substring(localStart, localEnd);
          const after = node.textContent.substring(localEnd);
          
          const span = document.createElement('span');
          span.className = 'highlighted-text';
          span.dataset.highlightId = id;
          span.style.cssText = `
            background:${colorData.bg};
            border-bottom:2px solid ${colorData.border};
            padding:2px 0;
            cursor:pointer;
            transition:all 0.2s;
            border-radius:2px;
          `;
          span.textContent = highlighted;
          
          // Hover effect
          span.addEventListener('mouseenter', () => {
            span.style.background = colorData.border;
            span.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          });
          span.addEventListener('mouseleave', () => {
            span.style.background = colorData.bg;
            span.style.boxShadow = 'none';
          });
          
          // Delete on click
          span.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await deleteHighlight(id);
          });
          
          // Replace node
          const fragment = document.createDocumentFragment();
          if (before) fragment.appendChild(document.createTextNode(before));
          fragment.appendChild(span);
          if (after) fragment.appendChild(document.createTextNode(after));
          
          node.parentNode.replaceChild(fragment, node);
          break;
        }
      }
    }
  });
}

/**
 * Delete a highlight
 */
async function deleteHighlight(highlightId) {
  try {
    console.log('Deleting highlight:', highlightId);
    
    const response = await fetch(`/api/highlights/${highlightId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Delete failed:', error);
      throw new Error('Failed to delete highlight');
    }
    
    // Remove from local array
    highlights = highlights.filter(h => h.id != highlightId);
    console.log('Highlights after delete:', highlights.length);
    
    // Reload content and re-render
    await loadHighlights();
    
    if (window.showToast) {
      window.showToast('Highlight removed ✓', 'success');
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
