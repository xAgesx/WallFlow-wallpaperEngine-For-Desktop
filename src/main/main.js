const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { getSettings, setSettings } = require('./store');
const { search, searchAll, recommend, listSources, SOURCES, CONTENTS, isAnimatedItem } = require('./apis');
const { initLibrary } = require('./library');
const { WallpaperEngine } = require('./wallpaper');
const { loadEnv } = require('./env');

loadEnv(); // local .env -> process.env (real environment variables win)

const engine = new WallpaperEngine();
let libraryWindow = null;
let tray = null;
let quitting = false;

function createLibraryWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0d13',
    autoHideMenuBar: true,
    title: 'WallFlow',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'library', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (getSettings().minimizeOnStart) win.hide();
  });
  win.on('close', (e) => {
    if (!quitting && getSettings().trayOnClose) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
}

function createTray() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image);
  tray.setToolTip('WallFlow');
  const menu = Menu.buildFromTemplate([
    { label: 'Open WallFlow', click: () => { libraryWindow.show(); libraryWindow.focus(); } },
    { type: 'separator' },
    {
      label: 'Stop wallpaper',
      click: () => { engine.stop(); syncTray(); },
    },
    {
      label: 'Resume wallpaper',
      click: async () => { await engine.restoreFromSettings(); syncTray(); },
    },
    { type: 'separator' },
    { label: 'Exit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    libraryWindow.show();
    libraryWindow.focus();
  });
}

function syncTray() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open WallFlow', click: () => { libraryWindow.show(); libraryWindow.focus(); } },
      { type: 'separator' },
      engine.current
        ? { label: 'Stop wallpaper', click: () => { engine.stop(); syncTray(); } }
        : { label: 'Resume wallpaper', click: async () => { await engine.restoreFromSettings(); syncTray(); } },
      { type: 'separator' },
      { label: 'Exit', click: () => { quitting = true; app.quit(); } },
    ])
  );
}

function setStartWithWindows(enabled) {
  const ps = path.join(__dirname, 'autostart.ps1');
  spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', ps,
    '-Enable', enabled ? '1' : '0',
    '-Exe', process.execPath,
    '-AppDir', app.getAppPath(),
    '-Dev', app.isPackaged ? '0' : '1',
  ], { windowsHide: true });
}

function providerKeys() {
  const s = getSettings();
  // settings entered in the UI win; keys from .env / environment fill the gaps
  return {
    wallhavenKey: s.wallhavenKey || process.env.WALLHAVEN_API_KEY || '',
    pexelsKey: s.pexelsKey || process.env.PEXELS_API_KEY || '',
    unsplashKey: s.unsplashKey || process.env.UNSPLASH_ACCESS_KEY || '',
    pixabayKey: s.pixabayKey || process.env.PIXABAY_API_KEY || '',
    tenorKey: s.tenorKey || process.env.TENOR_API_KEY || '',
  };
}

function initIpc() {
  ipcMain.handle('app:sources', async () => {
    const s = getSettings();
    return listSources(providerKeys(), {
      animatedOnly: !!s.animatedOnly,
      disabled: new Set(s.disabledSources || []),
    });
  });
  // every source, regardless of key/disabled state — powers the Settings switches
  ipcMain.handle('app:allSources', async () =>
    SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      requiresKey: s.requiresKey || null,
      animated: !!s.animated,
    }))
  );
  ipcMain.handle('app:contents', async () => CONTENTS);
  ipcMain.handle('app:search', async (_e, opts) => {
    try {
      const enriched = { ...opts, keys: providerKeys() };
      if (opts.source === 'all') return await searchAll(enriched);
      if (opts.source === 'recommend') return await recommend(enriched);
      return await search(opts.source, enriched);
    } catch (e) {
      return { items: [], hasMore: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:set', async (_e, patch) => {
    const prev = getSettings();
    const next = setSettings(patch);
    engine.broadcastSettings();
    if ('startWithWindows' in patch && patch.startWithWindows !== prev.startWithWindows) {
      setStartWithWindows(next.startWithWindows);
    }
    if ('parallax' in patch || 'companion' in patch) {
      engine.syncCursorFeed();
    }
    if ('playlist' in patch) {
      if (next.playlist) engine.startPlaylist();
      else engine.stopPlaylist();
    } else if ('playlistInterval' in patch || 'playlistSource' in patch || 'shuffle' in patch) {
      if (next.playlist) engine.startPlaylist();
    }
    if ('animatedOnly' in patch && next.animatedOnly !== prev.animatedOnly) {
      // rebuild playlist so stills drop out, and stop a running still wallpaper
      engine.refreshPlaylistItems();
      const cur = engine.current;
      if (next.animatedOnly && cur && !(cur.localPath || cur.uploaded) && !isAnimatedItem(cur)) {
        engine.stop();
      }
    }
    return next;
  });

  ipcMain.handle('app:minimize', async () => {
    if (libraryWindow) libraryWindow.hide();
  });
  ipcMain.handle('app:close', async () => {
    if (libraryWindow) libraryWindow.close();
  });

  ipcMain.handle('app:openExternal', async (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
  });
  ipcMain.handle('app:reveal', async (_e, p) => {
    if (typeof p === 'string' && fs_exists(p)) shell.showItemInFolder(p);
  });
  ipcMain.handle('app:playlistRefresh', async () => {
    engine.refreshPlaylistItems();
    if (getSettings().playlist) engine.startPlaylist();
    return { count: engine.playlistItems.length };
  });

  engine.onStatus = (status) => {
    if (libraryWindow && !libraryWindow.isDestroyed()) {
      libraryWindow.webContents.send('evt:wallpaper', status);
    }
    syncTray();
  };
}

function fs_exists(p) {
  try { require('fs').accessSync(p); return true; } catch { return false; }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (libraryWindow) {
      libraryWindow.show();
      libraryWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.wallflow.app');
    createTray();
    libraryWindow = createLibraryWindow();
    initIpc();
    initLibrary();
    engine.init();
    await engine.restoreFromSettings();
    syncTray();
  });

  app.on('window-all-closed', (e) => {
    // keep running in tray
  });

  app.on('before-quit', () => {
    quitting = true;
    // wallpaper windows are gone shortly after — stop the cursor timer and
    // kill the companion sensor process so it never outlives the app
    engine.stopCursorFeed();
    engine.stopCompanionSensors();
  });
}
