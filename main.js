const { app, BrowserWindow, shell, Menu, nativeImage, Tray, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let unreadCount = 0;

const MESSENGER_URL = 'https://www.messenger.com/';

// Custom user agent to avoid mobile redirects
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function createWindow() {
  // Get saved window bounds or use defaults
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    minWidth: 400,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      partition: 'persist:messenger', // Persistent session storage - keeps login after quit
      webSecurity: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  // Set custom user agent
  mainWindow.webContents.setUserAgent(USER_AGENT);

  // Load Messenger
  mainWindow.loadURL(MESSENGER_URL);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    injectCustomStyles();
    
    // Verify session persistence (for debugging)
    const ses = mainWindow.webContents.session;
    console.log('Session partition:', ses.partition);
    if (ses.getStoragePath) {
      console.log('Session storage path:', ses.getStoragePath());
    }
    
    // Check cookies to verify persistence
    ses.cookies.get({ domain: '.messenger.com' }).then(cookies => {
      console.log(`Found ${cookies.length} Messenger cookies (session should persist)`);
    }).catch(() => {});
  });

  // Inject styles after navigation
  mainWindow.webContents.on('did-finish-load', () => {
    injectCustomStyles();
    updateBadge();
    checkLoginStatus();
  });

  // Also inject on DOM ready for better reliability
  mainWindow.webContents.on('dom-ready', () => {
    injectCustomStyles();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.includes('messenger.com') && !url.includes('facebook.com')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Save window position on close
  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Check for unread messages periodically
  setInterval(updateBadge, 5000);
}

function injectCustomStyles() {
  if (!mainWindow) return;
  const cssPath = path.join(__dirname, 'styles.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    // Remove any previously injected styles by ID, then inject fresh
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const existing = document.getElementById('messenger-desktop-styles');
        if (existing) existing.remove();
        const style = document.createElement('style');
        style.id = 'messenger-desktop-styles';
        style.textContent = ${JSON.stringify(css)};
        document.head.appendChild(style);
      })();
    `).catch(() => {
      // Fallback to insertCSS if executeJavaScript fails
      mainWindow.webContents.insertCSS(css);
    });
  }
}

function reloadStyles() {
  injectCustomStyles();
}

async function checkLoginStatus() {
  if (!mainWindow) return;
  
  try {
    // Check if user is logged in by looking for login form or chat interface
    const isLoggedIn = await mainWindow.webContents.executeJavaScript(`
      (function() {
        // If we see the chat interface, we're logged in
        const chatInterface = document.querySelector('[role="main"]') || 
                             document.querySelector('[data-pagelet="ChatTab"]') ||
                             document.querySelector('div[aria-label*="Chat"]');
        
        // If we see login form, we're not logged in
        const loginForm = document.querySelector('input[type="password"]') ||
                         document.querySelector('form[action*="login"]');
        
        return !loginForm && (chatInterface !== null);
      })();
    `);
    
    if (isLoggedIn) {
      console.log('✓ User is logged in - session persisted successfully!');
    } else {
      console.log('⚠ User needs to log in');
    }
  } catch (e) {
    // Ignore errors
  }
}

async function updateBadge() {
  if (!mainWindow) return;

  try {
    // Check for unread count in the page title or favicon
    const count = await mainWindow.webContents.executeJavaScript(`
      (function() {
        // Try to get count from title
        const title = document.title;
        const match = title.match(/\\((\\d+)\\)/);
        if (match) return parseInt(match[1]);
        
        // Check for notification dots
        const dots = document.querySelectorAll('[aria-label*="unread"]');
        return dots.length;
      })();
    `);

    unreadCount = count || 0;
    
    if (unreadCount > 0) {
      app.dock.setBadge(unreadCount.toString());
    } else {
      app.dock.setBadge('');
    }
  } catch (e) {
    // Ignore errors during page load
  }
}

function createMenu() {
  const template = [
    {
      label: 'Messenger',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            mainWindow.loadURL(MESSENGER_URL + 'settings');
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [
            { role: 'startSpeaking' },
            { role: 'stopSpeaking' }
          ]
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        {
          label: 'Reload Styles',
          accelerator: 'Cmd+Shift+R',
          click: () => {
            reloadStyles();
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: 'New Chat',
          accelerator: 'Cmd+N',
          click: () => {
            mainWindow.loadURL(MESSENGER_URL + 'new');
          }
        },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Messenger Help',
          click: async () => {
            await shell.openExternal('https://www.facebook.com/help/messenger-app');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function loadWindowState() {
  try {
    const statePath = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) {
    // Return defaults
  }
  return {};
}

function saveWindowState() {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  const statePath = path.join(app.getPath('userData'), 'window-state.json');
  
  try {
    fs.writeFileSync(statePath, JSON.stringify(bounds));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Configure persistent session for cookies and login
    const persistentSession = session.fromPartition('persist:messenger');
    
    // Ensure cookies are persisted (they are by default with persist: partition)
    // Set up permission handlers
    persistentSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow notifications
      if (permission === 'notifications') {
        callback(true);
      } else {
        callback(false);
      }
    });

    createMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow.show();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle certificate errors for development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
