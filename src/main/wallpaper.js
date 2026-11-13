const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { getSettings, setSettings } = require('./store');

function hwndToInt(buffer) {
  const big = buffer.readBigUInt64LE(0);
  return BigInt.asIntN(64, big).toString();
}

function runParentScript(hwnd, bounds, stable) {
  return new Promise((resolve) => {
    const script = path.join(__dirname, 'attach.ps1');
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Hwnd',
      String(hwnd),
      '-X',
      String(Math.round(bounds.x)),
      '-Y',
      String(Math.round(bounds.y)),
      '-W',
      String(Math.round(bounds.width)),
      '-H',
      String(Math.round(bounds.height)),
    ];
    // retry mode: skip the shell's wallpaper layer and use Progman only
    if (stable) args.push('-Stable');
    const ps = spawn('powershell.exe', args, { windowsHide: true });
    let out = '';
    let err = '';
    let done = false;
    let timer = null;
    const finish = (code, o, e) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ code, out: o, err: e });
    };
    // PowerShell startup + Add-Type compile takes ~5s; a hung script must
    // still never block showing the window forever
    timer = setTimeout(() => {
      try { ps.kill(); } catch { /* ignore */ }
      finish(-2, '', 'timeout');
    }, 10000);
    ps.stdout.on('data', (d) => (out += d));
    ps.stderr.on('data', (d) => (err += d));
    ps.on('close', (code) => finish(code, out.trim(), err.trim()));
    ps.on('error', (e) => finish(-1, '', String(e)));
  });
}

class WallpaperEngine {
  constructor() {
    this.windows = new Map(); // displayId -> BrowserWindow
    this.toggles = new Map(); // displayId -> companion toggle window
    this.current = null;
    this.previewing = false;
    this.previewOf = null;
    this.playlistTimer = null;
    this.playlistIndex = 0;
    this.playlistItems = [];
    this.attached = new Set();
    this.cursorTimer = null;
    this.cursorInterval = 0;
    this.sensorProc = null;
    this.sensorBuf = '';
    this.busy = false;
    this.onStatus = null;
    this.healTimer = null;
    this.healTimes = [];
    this.attachQueue = Promise.resolve();
    this.unstableLayer = false;
  }

  init() {
    ipcMain.handle('wallpaper:apply', async (_e, payload) => {
      const persist = payload && payload.persist !== false;
      await this.apply(payload.item, { persist });
      return this.status();
    });
    ipcMain.handle('wallpaper:stop', async () => {
      this.stop();
      return this.status();
    });
    ipcMain.handle('wallpaper:status', async () => this.status());
    ipcMain.handle('wallpaper:discardPreview', async () => {
      await this.discardPreview();
      return this.status();
    });

    const settings = getSettings();
    this.cursorInterval = 0;
    if (settings.parallax || settings.companion) this.syncCursorFeed();

    screen.on('display-added', () => this.rebuild());
    screen.on('display-removed', () => this.rebuild());
    screen.on('display-metrics-changed', () => this.rebuild());
  }

  status() {
    return {
      active: !!this.current,
      previewing: this.previewing,
      item: this.current,
      // the item currently being previewed (what "Keep" will save), not the
      // original we'd fall back to on discard
      previewItem: this.previewing ? this.current : null,
      previewOriginal: this.previewOf,
      playlistOn: !!this.playlistTimer,
      playlistIndex: this.playlistIndex,
      playlistTotal: this.playlistItems.length,
    };
  }

  emit() {
    if (this.onStatus) this.onStatus(this.status());
  }

  queueAttach(hwnd, bounds, stable) {
    // serialize attach.ps1 runs: two parallel scripts both firing 0x052C can
    // make the shell recreate the desktop layer and destroy a sibling window
    const job = this.attachQueue.then(() => runParentScript(hwnd, bounds, stable));
    this.attachQueue = job.catch(() => { /* handled by caller */ });
    return job;
  }

  createWindows() {
    const displays = screen.getAllDisplays();
    for (const display of displays) {
      this.ensureToggle(display);
      if (this.windows.has(display.id)) continue;
      const b = display.bounds;
      // Electron reports DIP bounds; attach.ps1 is DPI-aware and positions the
      // window in physical pixels — convert or it lands on the wrong rect
      let phys = b;
      try {
        const r = screen.dipToScreenRect(null, b);
        if (r && typeof r.width === 'number') phys = r;
      } catch {
        try {
          const sf = display.scaleFactor || 1;
          phys = {
            x: Math.round(b.x * sf),
            y: Math.round(b.y * sf),
            width: Math.round(b.width * sf),
            height: Math.round(b.height * sf),
          };
        } catch { /* fall back to DIP */ }
      }
      const win = new BrowserWindow({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        frame: false,
        transparent: false,
        backgroundColor: '#000000',
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        alwaysOnTop: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
          sandbox: true,
        },
      });
      win.__wfShown = false;
      // the shell can destroy the window out from under us (sleep/resume,
      // desktop layer recycle) — drop it from the maps so apply() recreates
      // instead of broadcasting into a dead window forever
      win.on('closed', () => {
        if (this.windows.get(display.id) === win) this.windows.delete(display.id);
        this.attached.delete(display.id);
        if (this.current) this.scheduleHeal();
      });
      const show = () => {
        if (win.isDestroyed() || win.__wfShown) return;
        win.__wfShown = true;
        try { win.showInactive(); } catch { /* ignore */ }
      };
      win.setMenuBarVisibility(false);
      win.setIgnoreMouseEvents(true, { forward: false });
      win
        .loadFile(path.join(__dirname, '..', 'wallpaper', 'index.html'))
        .then(() => {
          // reparent behind desktop icons BEFORE showing so it never covers the desktop
          setTimeout(async () => {
            if (win.isDestroyed()) return;
            // never let a hung attach script leave the window invisible
            const showTimer = setTimeout(show, 8000);
            let attached = false;
            for (let attempt = 0; attempt < 2 && !attached; attempt++) {
              try {
                // second attempt (or after a shell layer took our window down
                // with it) sticks to the stable Progman target only
                const stable = attempt === 1 || this.unstableLayer;
                const res = await this.queueAttach(hwndToInt(win.getNativeWindowHandle()), phys, stable);
                attached = res.code === 0 && res.out.startsWith('OK');
                if (res.out && res.out.indexOf('TARGETDIED') !== -1) this.unstableLayer = true;
              } catch { /* retry below */ }
              if (!attached) await new Promise((r) => setTimeout(r, 500));
            }
            clearTimeout(showTimer);
            if (attached) this.attached.add(display.id);
            if (win.isDestroyed()) return;
            show();
            if (this.current) this.sendItem(win, this.current, false);
          }, 250);
        })
        .catch(() => {
          // failed to load — destroy so the map cleans up and heal can retry
          try { if (!win.isDestroyed()) win.destroy(); } catch { /* ignore */ }
        });

      this.windows.set(display.id, win);
    }
  }

  /* Small always-present button on the desktop that toggles the companion.
     It is a normal top-level window (never reparented), so it floats above
     the icons but is naturally covered by maximized apps and games. */
  ensureToggle(display) {
    const existing = this.toggles.get(display.id);
    if (existing && !existing.isDestroyed()) return;
    const area = display.workArea; // keep clear of the taskbar
    const size = 44;
    const gap = 16;
    const win = new BrowserWindow({
      x: area.x + gap,
      y: area.y + area.height - size - gap,
      width: size,
      height: size,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      title: 'WallFlow Companion Toggle',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setMenuBarVisibility(false);
    win.on('closed', () => {
      if (this.toggles.get(display.id) === win) this.toggles.delete(display.id);
      // the wallpaper lives on, so put a fresh button back (heal does this too)
      if (this.current) this.scheduleHeal();
    });
    win.loadFile(path.join(__dirname, '..', 'floating', 'companion-toggle.html'))
      .then(() => {
        if (win.isDestroyed()) return;
        try { win.showInactive(); } catch { /* ignore */ }
      })
      .catch(() => {
        try { if (!win.isDestroyed()) win.destroy(); } catch { /* ignore */ }
      });
    this.toggles.set(display.id, win);
  }

  destroyWindows() {
    for (const win of this.windows.values()) {
      try { win.destroy(); } catch { /* ignore */ }
    }
    this.windows.clear();
    this.attached.clear();
    for (const win of this.toggles.values()) {
      try { win.destroy(); } catch { /* ignore */ }
    }
    this.toggles.clear();
  }

  rebuild() {
    this.destroyWindows();
    if (this.current) this.createWindows();
  }

  /* -------- self-heal -------- */

  // drop windows the shell destroyed (externally-dead HWNDs report
  // isVisible() === false once they have been shown)
  pruneWindows() {
    for (const [id, win] of this.windows) {
      let dead = false;
      try {
        dead = !win || win.isDestroyed() || (!!win.__wfShown && !win.isVisible());
      } catch { dead = true; }
      if (!dead) continue;
      this.windows.delete(id);
      this.attached.delete(id);
      try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* ignore */ }
    }
    // forget windows for displays that no longer exist
    const valid = new Set(screen.getAllDisplays().map((d) => d.id));
    for (const id of [...this.windows.keys()]) {
      if (valid.has(id)) continue;
      const win = this.windows.get(id);
      this.windows.delete(id);
      this.attached.delete(id);
      try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* ignore */ }
    }
  }

  scheduleHeal() {
    if (this.healTimer) clearTimeout(this.healTimer);
    this.healTimer = setTimeout(() => {
      this.healTimer = null;
      this.heal();
    }, 3000);
  }

  // recreate missing wallpaper windows: re-validates at fire time, rate-limited
  // so a pathological shell can't thrash window creation
  heal() {
    if (!this.current) return;
    const now = Date.now();
    this.healTimes = this.healTimes.filter((t) => now - t < 60000);
    if (this.healTimes.length >= 3) return;
    this.pruneWindows();
    const displays = screen.getAllDisplays();
    const missing = displays.some((d) => {
      const toggle = this.toggles.get(d.id);
      return !this.windows.has(d.id) || !toggle || toggle.isDestroyed();
    });
    if (!missing) return;
    this.healTimes.push(now);
    // recreated windows pick up this.current after their page loads
    this.createWindows();
  }

  sendItem(win, item, transition) {
    if (!win || win.isDestroyed()) return;
    const settings = getSettings();
    win.webContents.send('wallpaper:show', {
      item,
      settings,
      transition: transition !== false,
    });
  }

  broadcast(item, transition) {
    for (const [id, win] of this.windows) {
      if (!win || win.isDestroyed()) {
        this.windows.delete(id);
        this.attached.delete(id);
        continue;
      }
      // the shell may have hidden our window — bring it back before sending
      if (win.__wfShown && !win.isVisible()) {
        try { win.showInactive(); } catch { /* ignore */ }
      }
      this.sendItem(win, item, transition);
    }
  }

  broadcastSettings() {
    const settings = getSettings();
    for (const win of this.windows.values()) {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send('wallpaper:settings', settings);
    }
    for (const win of this.toggles.values()) {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send('wallpaper:settings', settings);
    }
  }

  async apply(item, { persist = true } = {}) {
    if (!item) return;
    this.busy = true;
    try {
      if (persist) {
        this.previewing = false;
        this.previewOf = null;
        setSettings({ currentWallpaper: item });
      } else if (!this.previewing) {
        // start a preview session: previewOf is the wallpaper to fall back to
        // on discard (null when nothing was set yet — the bar must still show)
        this.previewing = true;
        this.previewOf = this.current;
      }
      this.current = item;
      // dead windows must not keep apply() stuck in the broadcast branch, and
      // every display needs its own window — prune, fill gaps, then deliver
      this.pruneWindows();
      const hadWindows = this.windows.size > 0;
      this.createWindows(); // idempotent: one window per display
      if (hadWindows) this.broadcast(item, true);
      this.scheduleHeal();
      this.syncCursorFeed();
      if (getSettings().playlist) this.startPlaylist();
      this.emit();
    } finally {
      this.busy = false;
    }
  }

  async discardPreview() {
    if (!this.previewing) return;
    const original = this.previewOf;
    this.previewing = false;
    this.previewOf = null;
    if (original) {
      await this.apply(original, { persist: true });
    } else if (this.current) {
      // previewed over an empty desktop — nothing to restore, just drop it
      this.current = null;
      this.stopCursorFeed();
      this.destroyWindows();
      this.emit();
    }
  }

  stop() {
    this.current = null;
    if (this.healTimer) { clearTimeout(this.healTimer); this.healTimer = null; }
    this.previewing = false;
    this.previewOf = null;
    setSettings({ currentWallpaper: null });
    this.stopPlaylist();
    this.stopCursorFeed();
    this.destroyWindows();
    this.emit();
  }

  async restoreFromSettings() {
    const settings = getSettings();
    if (settings.currentWallpaper) {
      // persist:true writes back the same value but clears any preview state,
      // so a restore never leaves a phantom preview session behind
      await this.apply(settings.currentWallpaper, { persist: true });
    }
    if (settings.playlist) this.startPlaylist();
  }

  /* -------- playlist -------- */

  setPlaylistItems(items) {
    this.playlistItems = items;
    if (getSettings().playlist) this.startPlaylist();
  }

  startPlaylist() {
    const settings = getSettings();
    this.stopPlaylist();
    if (!settings.playlist) return;
    this.refreshPlaylistItems();
    if (this.playlistItems.length < 2) return;
    const ms = Math.max(30, settings.playlistInterval) * 1000;
    const tick = async () => {
      if (!getSettings().playlist) return;
      if (this.playlistItems.length) {
        if (settings.shuffle) {
          if (this.playlistItems.length > 1) {
            let idx;
            do {
              idx = Math.floor(Math.random() * this.playlistItems.length);
            } while (idx === this.playlistIndex);
            this.playlistIndex = idx;
          }
        } else {
          this.playlistIndex = (this.playlistIndex + 1) % this.playlistItems.length;
        }
        const next = this.playlistItems[this.playlistIndex];
        if (next && this.current && next.id !== this.current.id) {
          await this.apply(next, { persist: true });
        }
      }
      this.playlistTimer = setTimeout(tick, ms);
    };
    this.playlistTimer = setTimeout(tick, ms);
    this.emit();
  }

  stopPlaylist() {
    if (this.playlistTimer) clearTimeout(this.playlistTimer);
    this.playlistTimer = null;
    this.emit();
  }

  refreshPlaylistItems() {
    const { getFavorites, getLibrary, getSettings } = require('./store');
    const { isAnimatedItem } = require('./apis');
    const settings = getSettings();
    const source = settings.playlistSource;
    const animOnly = !!settings.animatedOnly;
    const favs = getFavorites();
    const lib = getLibrary();
    let items = [];
    if (source === 'favorites') items = favs;
    else if (source === 'library') items = lib;
    else items = [...lib, ...favs.filter((f) => !lib.some((l) => l.id === f.id))];
    const seen = new Set();
    this.playlistItems = items.filter((i) => {
      if (!i || seen.has(i.id)) return false;
      seen.add(i.id);
      if (animOnly) {
        const local = !!(i.localPath || i.uploaded);
        if (!local && !isAnimatedItem(i)) return false;
      }
      return true;
    });
  }

  /* -------- cursor feed (parallax + companion) -------- */

  // single shared timer: 66ms when only parallax needs it, 16ms when the
  // companion is tracking the cursor frame-by-frame
  syncCursorFeed() {
    const settings = getSettings();
    const on = !!(settings.parallax || settings.companion);
    const interval = settings.companion ? 16 : 66;
    if (!on || !this.current) {
      this.stopCursorFeed();
    } else if (!(this.cursorTimer && this.cursorInterval === interval)) {
      this.stopCursorFeed();
      this.cursorInterval = interval;
      this.cursorTimer = setInterval(() => this.tickCursor(), interval);
    }
    this.syncCompanionSensors();
  }

  stopCursorFeed() {
    if (this.cursorTimer) clearInterval(this.cursorTimer);
    this.cursorTimer = null;
    this.cursorInterval = 0;
    this.stopCompanionSensors();
  }

  /* -------- companion sensors (mouse buttons + system volume) --------
     A single persistent PowerShell process streams button/volume events;
     they are forwarded to the wallpaper windows as `wallpaper:event`. */

  syncCompanionSensors() {
    const want = !!(getSettings().companion && this.current);
    if (!want) {
      this.stopCompanionSensors();
      return;
    }
    if (this.sensorProc) return;
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'sensors.ps1')],
      { windowsHide: true }
    );
    this.sensorBuf = '';
    ps.stdout.on('data', (d) => this.onSensorData(d));
    ps.stderr.on('data', () => { /* ignore */ });
    ps.on('error', () => {
      if (this.sensorProc === ps) { this.sensorProc = null; this.sensorBuf = ''; }
    });
    ps.on('exit', () => {
      if (this.sensorProc === ps) { this.sensorProc = null; this.sensorBuf = ''; }
    });
    this.sensorProc = ps;
  }

  stopCompanionSensors() {
    if (this.sensorProc) {
      try { this.sensorProc.kill(); } catch { /* ignore */ }
    }
    this.sensorProc = null;
    this.sensorBuf = '';
  }

  onSensorData(d) {
    this.sensorBuf += d.toString();
    let idx;
    while ((idx = this.sensorBuf.indexOf('\n')) >= 0) {
      const line = this.sensorBuf.slice(0, idx).trim();
      this.sensorBuf = this.sensorBuf.slice(idx + 1);
      this.handleSensorLine(line);
    }
    if (this.sensorBuf.length > 4096) this.sensorBuf = '';
  }

  handleSensorLine(line) {
    let m = /^M ([LRM]) ([01])$/.exec(line);
    if (m) {
      const button = m[1] === 'L' ? 'left' : m[1] === 'R' ? 'right' : 'middle';
      this.broadcastEvent({ type: 'mouse', button, down: m[2] === '1' });
      return;
    }
    m = /^V (\d{1,3})$/.exec(line);
    if (m) this.broadcastEvent({ type: 'volume', value: Math.min(100, Number(m[1])) });
  }

  broadcastEvent(ev) {
    for (const win of this.windows.values()) {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send('wallpaper:event', ev);
    }
  }

  tickCursor() {
    if (!this.current) return;
    const point = screen.getCursorScreenPoint();
    for (const win of this.windows.values()) {
      if (!win || win.isDestroyed()) continue;
      // normalize against the window's own bounds so multi-monitor layouts
      // each get a correct -1..1 range for their display
      const b = win.getBounds();
      const nx = ((point.x - b.x) / b.width) * 2 - 1;
      const ny = ((point.y - b.y) / b.height) * 2 - 1;
      win.webContents.send('wallpaper:parallax', {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      });
    }
  }
}

module.exports = { WallpaperEngine };
