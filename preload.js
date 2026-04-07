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