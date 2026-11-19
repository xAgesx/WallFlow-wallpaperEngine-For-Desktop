/* Workshop uploads: the renderer asks, the main process picks the file,
 * uploads it straight to Vercel Blob (client token minted by our API so no
 * write token ever ships in the app), then confirms the metadata. */
const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { upload } = require('@vercel/blob/client');

const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VID_EXT = ['.mp4', '.webm'];
const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

function workshopBase() {
  const fromEnv = (process.env.WALLFLOW_WORKSHOP_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  try {
    const { PROXY_URL } = require('./config');
    if (PROXY_URL) return new URL(PROXY_URL).origin;
  } catch {
    /* ignore */
  }
  return '';
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error((data && data.error) || `request failed (${res.status})`);
  return data;
}

function initWorkshop() {
  ipcMain.handle('workshop:submit', async (e, meta) => {
    try {
      const base = workshopBase();
      if (!base) return { error: 'The Workshop is not available right now' };

      const win = BrowserWindow.fromWebContents(e.sender);
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Choose a wallpaper to share',
        filters: [
          { name: 'Wallpapers', extensions: [...IMG_EXT, ...VID_EXT].map((x) => x.slice(1)) },
        ],
        properties: ['openFile'],
      });
      if (canceled || !filePaths || !filePaths[0]) return { canceled: true };

      const file = filePaths[0];
      const ext = path.extname(file).toLowerCase();
      const isVideo = VID_EXT.includes(ext);
      const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
      if (!IMG_EXT.includes(ext) && !isVideo) return { error: 'Unsupported file type' };
      const st = await fs.stat(file);
      if (st.size > max) {
        return { error: `File is too large (max ${Math.round(max / 1048576)} MB)` };
      }

      const id = crypto.randomUUID();
      const pathname = `uploads/${id}${ext}`;
      const buf = await fs.readFile(file);

      // client upload: bytes go straight to the Blob store, our API only
      // mints the constrained token
      const blob = await upload(pathname, buf, {
        access: 'public',
        handleUploadUrl: `${base}/api/workshop/submit`,
        clientPayload: JSON.stringify({ id }),
      });

      await postJson(`${base}/api/workshop/submit`, {
        action: 'confirm',
        id,
        pathname,
        handle: (meta && meta.handle) || '',
        title: (meta && meta.title) || '',
        tags: (meta && meta.tags) || [],
        nsfw: !!(meta && meta.nsfw),
      });

      return { ok: true, url: blob.url };
    } catch (err) {
      return { error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle('workshop:report', async (_e, id) => {
    try {
      const base = workshopBase();
      if (!base) return { error: 'The Workshop is not available right now' };
      await postJson(`${base}/api/workshop/report`, { id: String(id || '') });
      return { ok: true };
    } catch (err) {
      return { error: String((err && err.message) || err) };
    }
  });
}

module.exports = { initWorkshop };
