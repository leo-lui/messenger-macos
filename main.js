const { app, BrowserWindow, shell, Menu, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Force same userData for dev and packaged builds
app.setPath('userData', path.join(app.getPath('appData'), 'messenger-desktop'));

// Avoid GPU crashes on unsigned macOS builds
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Chrome-like User Agent (no "Electron" string) - use latest Chrome version
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
app.userAgentFallback = USER_AGENT;

// Hide Electron from detection
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

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
      webSecurity: false, // Disable web security to bypass some restrictions
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  mainWindow.webContents.setUserAgent(USER_AGENT);

  // Set additional headers to look more like a real browser and bypass detection
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    // Remove any Electron-related headers
    delete details.requestHeaders['User-Agent'];
    delete details.requestHeaders['user-agent'];
    
    // Add convincing browser headers
    details.requestHeaders['User-Agent'] = USER_AGENT;
    details.requestHeaders['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    details.requestHeaders['sec-ch-ua-mobile'] = '?0';
    details.requestHeaders['sec-ch-ua-platform'] = '"macOS"';
    details.requestHeaders['sec-fetch-dest'] = 'document';
    details.requestHeaders['sec-fetch-mode'] = 'navigate';
    details.requestHeaders['sec-fetch-site'] = 'none';
    details.requestHeaders['sec-fetch-user'] = '?1';
    details.requestHeaders['upgrade-insecure-requests'] = '1';
    details.requestHeaders['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    details.requestHeaders['accept-language'] = 'en-US,en;q=0.9';
    details.requestHeaders['cache-control'] = 'max-age=0';
    
    callback({ requestHeaders: details.requestHeaders });
  });

  // Load Facebook Messages directly
  mainWindow.loadURL(MESSENGER_URL);

  // Inject script to hide Electron detection
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      // Hide Electron detection
      Object.defineProperty(navigator, 'userAgent', {
        get: () => '${USER_AGENT}'
      });
      
      // Remove electron from process if it exists
      if (window.process && window.process.versions && window.process.versions.electron) {
        delete window.process.versions.electron;
      }
      
      // Hide other Electron indicators
      if (window.require) {
        delete window.require;
      }
      if (window.module) {
        delete window.module;
      }
      if (window.__dirname) {
        delete window.__dirname;
      }
      if (window.__filename) {
        delete window.__filename;
      }
      
      // Override chrome object to look more like regular Chrome
      if (!window.chrome) {
        window.chrome = {
          runtime: {},
          loadTimes: function() { return {}; },
          csi: function() { return {}; }
        };
      }
    `);
  });

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