const { app, BrowserWindow, shell, Menu, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Force same userData for dev and packaged builds
app.setPath('userData', path.join(app.getPath('appData'), 'messenger-desktop'));

// Avoid GPU crashes on unsigned macOS builds
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Chrome-like User Agent (no "Electron" string)
const USER_AGENT = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
app.userAgentFallback = USER_AGENT;

let mainWindow;
let unreadCount = 0;

const MESSENGER_URL = 'https://www.facebook.com/messages/';

function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    minWidth: 400,
    minHeight: 500,
    titleBarStyle: 'default',
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      partition: 'persist:messenger',
      webSecurity: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: true, // Show immediately
  });

  mainWindow.webContents.setUserAgent(USER_AGENT);

  // Error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.error('[did-fail-load]', errorCode, errorDescription, validatedURL);
      if (errorCode !== -3) { // Not aborted
        dialog.showErrorBox('Load Error', `${errorDescription}\n(${errorCode})\n${validatedURL}`);
      }
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[render-process-gone]', details);
    dialog.showErrorBox('Renderer Crashed', `Reason: ${details.reason}\nExit Code: ${details.exitCode}`);
  });

  // Debug logging
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[did-navigate]', url);
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) { // Warnings and errors
      console.log('[page]', message);
    }
  });

  // Load Facebook Messages directly
  mainWindow.loadURL(MESSENGER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Auto-open DevTools only when explicitly requested
    if (process.argv.includes('--devtools')) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }, 500);
    }

    // Session info
    const ses = mainWindow.webContents.session;
    console.log('Session partition:', ses.partition);
    console.log('Session path:', ses.getStoragePath?.());
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const u = new URL(url);
    if (u.hostname.includes('facebook.com') || u.hostname.includes('google.com')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Window state
  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadWindowState() {
  try {
    const statePath = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load window state:', e);
  }
  return {};
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const statePath = path.join(app.getPath('userData'), 'window-state.json');
    fs.writeFileSync(statePath, JSON.stringify(bounds));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function createMenu() {
  const template = [
    {
      label: 'Messenger',
      submenu: [
        { role: 'about' },
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
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
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
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  const persistentSession = session.fromPartition('persist:messenger');
  persistentSession.setUserAgent(USER_AGENT);

  persistentSession.setPermissionRequestHandler((webContents, permission, callback) => {
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
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});