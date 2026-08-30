const { app, BrowserWindow, shell, Menu, dialog, session, clipboard, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function showAppContextMenu(params, browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return;

  const items = [];

  if (params.linkURL) {
    items.push(
      {
        label: 'Open Link in New Window',
        click: () => openInNewWindow(params.linkURL),
      },
      {
        label: 'Copy Link',
        click: () => clipboard.writeText(params.linkURL),
      },
      { type: 'separator' }
    );
  }

  if (params.hasImageContents && params.srcURL) {
    items.push(
      {
        label: 'Open Image in New Window',
        click: () => openInNewWindow(params.srcURL),
      },
      {
        label: 'Copy Image Address',
        click: () => clipboard.writeText(params.srcURL),
      },
      { type: 'separator' }
    );
  }

  if (params.isEditable) {
    items.push(
      { role: 'cut', enabled: Boolean(params.editFlags?.canCut) },
      { role: 'copy', enabled: Boolean(params.editFlags?.canCopy) },
      { role: 'paste', enabled: Boolean(params.editFlags?.canPaste) },
      { role: 'selectAll', enabled: Boolean(params.editFlags?.canSelectAll) }
    );
  } else {
    if (params.selectionText) {
      items.push({ role: 'copy', enabled: Boolean(params.editFlags?.canCopy) });
    }
    items.push(
      { role: 'paste', enabled: Boolean(params.editFlags?.canPaste) },
      { role: 'selectAll', enabled: Boolean(params.editFlags?.canSelectAll) }
    );
  }

  if (params.selectionText && !params.linkURL) {
    const preview =
      params.selectionText.slice(0, 30) + (params.selectionText.length > 30 ? '…' : '');
    items.push(
      { type: 'separator' },
      {
        label: 'Search Google for “' + preview + '”',
        click: () => {
          shell.openExternal(
            'https://www.google.com/search?q=' + encodeURIComponent(params.selectionText)
          );
        },
      }
    );
  }

  if (items.length === 0) return;

  // Let Electron place the menu at the cursor (x/y from the page are not screen coords)
  Menu.buildFromTemplate(items).popup({ window: browserWindow });
}

function isAppHostedUrl(url) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname.includes('facebook.com') ||
      hostname.includes('messenger.com') ||
      hostname.includes('fb.com') ||
      hostname.includes('fbcdn.net') ||
      hostname.includes('google.com') // OAuth / login helpers
    );
  } catch {
    return false;
  }
}

function openInNewWindow(url) {
  if (!url || url === 'about:blank') return;
  // Keep Facebook/Messenger/auth flows in-app; everything else goes to the system browser
  if (isAppHostedUrl(url)) {
    const child = new BrowserWindow({
      width: 1000,
      height: 800,
      minWidth: 400,
      minHeight: 500,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true,
        partition: 'persist:messenger',
      },
      show: true,
    });
    child.webContents.setUserAgent(USER_AGENT);
    child.loadURL(url);
    child.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
      openInNewWindow(nextUrl);
      return { action: 'deny' };
    });
    return;
  }
  shell.openExternal(url);
}

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

  // target=_blank / window.open → new window (or system browser for external links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openInNewWindow(url);
    return { action: 'deny' };
  });

  // Same-window navigations away from Messenger → open externally instead
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppHostedUrl(url)) {
      event.preventDefault();
      openInNewWindow(url);
    }
  });

  // Fallback if Chromium still emits context-menu (editable fields, etc.)
  mainWindow.webContents.on('context-menu', (event, params) => {
    showAppContextMenu(params, mainWindow);
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

  // Preload captures right-click (Facebook cancels Chromium's context menu)
  ipcMain.on('show-context-menu', (event, params) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    showAppContextMenu(params, win);
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