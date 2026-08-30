const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('messengerApp', {
  // Platform info
  platform: process.platform,
  
  // Notification handling
  showNotification: (title, body) => {
    new Notification(title, { body });
  }
});

function closestHref(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    if (node.tagName === 'A' && node.href) return node.href;
    // Messenger sometimes wraps links without a real <a href>
    const href = node.getAttribute && (node.getAttribute('href') || node.getAttribute('data-href'));
    if (href && /^(https?:|mailto:|fb:)/i.test(href)) {
      try {
        return new URL(href, location.href).href;
      } catch {
        return href;
      }
    }
    node = node.parentElement;
  }
  return '';
}

function closestImageSrc(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    if (node.tagName === 'IMG' && node.src) return node.src;
    if (node.tagName === 'VIDEO' && (node.currentSrc || node.src || node.poster)) {
      return node.currentSrc || node.src || node.poster;
    }
    node = node.parentElement;
  }
  return '';
}

function isEditable(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.getAttribute?.('role') === 'textbox';
}

// Facebook cancels Chromium's context menu, so Electron's context-menu
// event never fires. Capture right-click first and ask main to show ours.
window.addEventListener(
  'contextmenu',
  (e) => {
    // Don't steal the drag title bar
    if (e.target && e.target.id === 'electron-drag-bar') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const selectionText = (window.getSelection && String(window.getSelection())) || '';
    const linkURL = closestHref(e.target);
    const srcURL = closestImageSrc(e.target);
    const editable = isEditable(e.target);

    ipcRenderer.send('show-context-menu', {
      x: e.clientX,
      y: e.clientY,
      linkURL,
      srcURL,
      hasImageContents: Boolean(srcURL),
      selectionText: selectionText.trim(),
      isEditable: editable,
      editFlags: {
        canCut: editable && selectionText.length > 0,
        canCopy: selectionText.length > 0 || Boolean(linkURL),
        canPaste: editable,
        canSelectAll: true,
      },
    });
  },
  true // capture — before Messenger's handlers
);

// Override the document title observer to track unread counts
window.addEventListener('DOMContentLoaded', () => {
  // Add custom class for styling
  document.body.classList.add('messenger-desktop-app');
  
  // Create draggable title bar area
  const dragBar = document.createElement('div');
  dragBar.id = 'electron-drag-bar';
  dragBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: transparent;
    -webkit-app-region: drag;
    z-index: 999999;
    pointer-events: auto;
  `;
  
  // Insert drag bar as first element
  document.body.insertBefore(dragBar, document.body.firstChild);
  
  // Add styles for the app
  const style = document.createElement('style');
  style.textContent = `
    .messenger-desktop-app {
      -webkit-app-region: no-drag;
    }
    
    /* Make sure content doesn't interfere with drag bar */
    body {
      padding-top: 0 !important;
    }
    
    /* Ensure drag bar stays on top */
    #electron-drag-bar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: 30px !important;
      background: transparent !important;
      -webkit-app-region: drag !important;
      z-index: 999999 !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Cmd+F for search
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    const searchInput = document.querySelector('[aria-label="Search Messenger"]') ||
                        document.querySelector('input[placeholder*="Search"]');
    if (searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  }
});