const { dialog, ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getLibrary, setLibrary, getFavorites, setFavorites, wallpapersDir } = require('./store');

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const VID_EXT = new Set(['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.ogg', '.ogv']);

function extFor(item) {
  try {
    const u = new URL(item.full || item.thumb || '', 'http://x');
    const ext = path.extname(u.pathname).toLowerCase();
    if (IMG_EXT.has(ext)) return ext;
    if (VID_EXT.has(ext)) return ext;
  } catch { /* ignore */ }
  return item.type === 'video' ? '.mp4' : '.jpg';
}

function safeName(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

async function fetchToFile(url, dest, onProgress) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WallFlow/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error('Download too small');
  fs.writeFileSync(dest, buf);
  if (onProgress) onProgress(buf.length, total || buf.length);
  return dest;
}

async function downloadItem(item, win) {
  const lib = getLibrary();
  const existing = lib.find((l) => l.id === item.id && l.localPath);
  if (existing && fs.existsSync(existing.localPath)) {
    return { ...existing, alreadyLocal: true };
  }
  const ext = extFor(item);
  const dest = path.join(wallpapersDir(), `${safeName(item.id)}-${Date.now()}${ext}`);
  await fetchToFile(item.full || item.thumb, dest);
  const entry = {
    ...item,
    localPath: dest,
    addedAt: Date.now(),
    downloaded: true,
  };
  setLibrary([entry, ...lib.filter((l) => l.id !== item.id)]);
  return entry;
}

async function importFiles(filePaths) {
  const lib = getLibrary();
  const dir = wallpapersDir();
  const added = [];
  for (const fp of filePaths) {
    const ext = path.extname(fp).toLowerCase();
    const type = VID_EXT.has(ext) ? 'video' : IMG_EXT.has(ext) ? 'image' : null;
    if (!type) continue;
    const base = path.basename(fp);
    const id = `local:${crypto.createHash('md5').update(fp + base).digest('hex').slice(0, 12)}`;
    const existing = lib.find((l) => l.id === id);
    if (existing && existing.localPath && fs.existsSync(existing.localPath)) {
      added.push(existing);
      continue;
    }
    const dest = path.join(dir, `${safeName(id)}-${Date.now()}${ext}`);
    fs.copyFileSync(fp, dest);
    const entry = {
      id,
      source: 'local',
      type,
      title: base.replace(ext, ''),
      author: 'You',
      pageUrl: '',
      thumb: type === 'image' ? `file://${dest}` : null,
      full: `file://${dest}`,
      localPath: dest,
      width: 0,
      height: 0,
      category: 'upload',
      tags: [],
      addedAt: Date.now(),
      uploaded: true,
    };
    added.push(entry);
  }
  if (added.length) {
    const incoming = new Set(added.map((a) => a.id));
    setLibrary([...added, ...lib.filter((l) => !incoming.has(l.id))]);
  }
  return added;
}

function removeLocal(id) {
  let lib = getLibrary();
  const entry = lib.find((l) => l.id === id);
  if (entry && entry.localPath) {
    try { fs.unlinkSync(entry.localPath); } catch { /* ignore */ }
  }
  lib = lib.filter((l) => l.id !== id);
  setLibrary(lib);
  setFavorites(getFavorites().filter((f) => f.id !== id));
  return lib;
}

function initLibrary() {
  ipcMain.handle('library:list', async () => getLibrary());
  ipcMain.handle('library:download', async (_e, item) => {
    const win = BrowserWindow.getFocusedWindow();
    return downloadItem(item, win);
  });
  ipcMain.handle('library:upload', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win, {
      title: 'Import wallpapers',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Wallpapers', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov', 'mkv'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv'] },
      ],
    });
    if (res.canceled) return [];
    return importFiles(res.filePaths);
  });
  ipcMain.handle('library:remove', async (_e, id) => removeLocal(id));

  ipcMain.handle('favorites:list', async () => getFavorites());
  ipcMain.handle('favorites:toggle', async (_e, item) => {
    const favs = getFavorites();
    const idx = favs.findIndex((f) => f.id === item.id);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.unshift({ ...item, favoritedAt: Date.now() });
    setFavorites(favs);
    return favs;
  });
}

module.exports = { initLibrary, downloadItem, importFiles };
