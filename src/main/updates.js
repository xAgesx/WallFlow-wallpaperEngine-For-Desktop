/* Auto-updates via electron-updater.
 *
 * The `publish` config in package.json makes electron-builder write
 * app-update.yml into resources, which points the packaged app at GitHub
 * Releases; electron-builder also emits latest.yml (+ .blockmap) next to the
 * installer, and all three must be attached to a release for a check to
 * succeed. Running from source has no app-update.yml, so everything is a
 * no-op there. */
const { app, ipcMain, dialog } = require('electron');

let autoUpdater = null;
let getWindow = () => null;
let state = { status: 'idle', version: null, percent: null, message: '' };

function snapshot() {
  return { appVersion: app.getVersion(), ...state };
}

// the raw updater errors carry stacks and full response bodies; the Settings
// row only has room for one readable line
function shortError(e) {
  const first = String((e && e.message) || e).split('\n')[0].trim();
  return first.length > 140 ? first.slice(0, 137) + '...' : first;
}

function push(patch) {
  Object.assign(state, patch);
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send('update:event', snapshot());
}

function doInstall() {
  if (!autoUpdater || state.status !== 'downloaded') return false;
  // silent NSIS upgrade + relaunch (the assisted installer honours /S)
  autoUpdater.quitAndInstall(true, true);
  return true;
}

async function promptInstall(info) {
  const win = getWindow();
  // window in front: the Settings screen shows the toast and install button
  if (win && !win.isDestroyed() && win.isVisible()) return;
  try {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'WallFlow update ready',
      message: `Version ${info.version} has been downloaded.`,
      detail:
        'Restart WallFlow now to install it, or it installs automatically the next time you quit.',
    });
    if (response === 0) doInstall();
  } catch {
    /* the user can still install it from Settings */
  }
}

function initUpdates(winGetter) {
  getWindow = winGetter || getWindow;

  ipcMain.handle('update:status', async () => snapshot());
  ipcMain.handle('update:check', async () => {
    if (!autoUpdater) return snapshot();
    try {
      push({ status: 'checking', message: '' });
      await autoUpdater.checkForUpdates();
    } catch (e) {
      push({ status: 'error', message: shortError(e) });
    }
    return snapshot();
  });
  ipcMain.handle('update:install', async () => doInstall());

  if (!app.isPackaged) {
    state.status = 'disabled';
    return; // running from source: no app-update.yml to read
  }

  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on('checking-for-update', () => push({ status: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    push({ status: 'available', version: info.version })
  );
  autoUpdater.on('update-not-available', () =>
    push({ status: 'uptodate', version: null, percent: null })
  );
  autoUpdater.on('download-progress', (p) =>
    push({ status: 'downloading', percent: Math.round(p.percent || 0) })
  );
  autoUpdater.on('update-downloaded', (info) => {
    push({ status: 'downloaded', version: info.version, percent: null });
    promptInstall(info);
  });
  autoUpdater.on('error', (err) => push({ status: 'error', message: shortError(err) }));

  // check a little after launch so it never competes with startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 15000);
}

module.exports = { initUpdates };
