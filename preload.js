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
  
  // Fix for drag region in hidden title bar
  const style = document.createElement('style');
  style.textContent = `
    .messenger-desktop-app {
      -webkit-app-region: no-drag;
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
