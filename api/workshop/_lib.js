/* Shared helpers for the workshop endpoints. Files under api/ whose path has
 * an underscore segment are not deployed as serverless functions.
 *
 * Metadata lives as one encrypted JSON document in the public Blob store.
 * The wallpaper files themselves are public (the grid loads them straight from
 * the store URL), but the index of pending/rejected uploads must not be
 * readable by anyone who guesses the path, so it is sealed with AES-256-GCM
 * under a key derived from ADMIN_TOKEN. */
const crypto = require('crypto');
const { put, head, del } = require('@vercel/blob');

const INDEX_PATH = 'meta/index.enc';

/* content-type -> extension + media kind */
const KINDS = {
  'image/jpeg': { ext: '.jpg', kind: 'image' },
  'image/png': { ext: '.png', kind: 'image' },
  'image/webp': { ext: '.webp', kind: 'image' },
  'image/gif': { ext: '.gif', kind: 'image' },
  'image/avif': { ext: '.avif', kind: 'image' },
  'video/mp4': { ext: '.mp4', kind: 'video' },
  'video/webm': { ext: '.webm', kind: 'video' },
};
const MAX_BYTES = { image: 20 * 1024 * 1024, video: 100 * 1024 * 1024 };

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATHNAME_RE = new RegExp(`^uploads/(${UUID_RE})(\\.[a-z0-9]{2,5})$`, 'i');

function json(res, status, body) {
  res.status(status).json(body);
}

/* Vercel parses JSON bodies into req.body; fall back to reading the stream. */
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof parsed === 'object' && parsed ? parsed : null;
  } catch {
    return null;
  }
}

/* uploads/<uuid>.<ext> -> { id, pathname, ext, kind } or null */
function parsePathname(pathname) {
  const m = PATHNAME_RE.exec(String(pathname || ''));
  if (!m) return null;
  const ext = m[2].toLowerCase();
  const kind = Object.values(KINDS).find((k) => k.ext === ext);
  if (!kind) return null;
  return { id: m[1].toLowerCase(), pathname: `uploads/${m[1].toLowerCase()}${ext}`, ext, kind: kind.kind };
}

function cleanStr(v, max) {
  return String(v || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function cleanTags(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v) {
    const tag = cleanStr(t, 24).toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

function indexKey() {
  return crypto.createHash('sha256').update('wallflow-index-v1:' + (process.env.ADMIN_TOKEN || '')).digest();
}

/* Public store URL host, parsed from the read-write token
 * (vercel_blob_rw_<STOREID>_<secret>). */
function publicBaseUrl() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  const parts = token.split('_');
  const storeId = parts.length > 3 ? parts[3] : '';
  if (!storeId) throw new Error('no blob credentials found');
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}

/* The index is overwritten in place, so every read must bypass the CDN: a
 * cache-busting query keeps read-your-writes true (a stale copy right after a
 * write would silently drop records on the next save). */
async function fetchIndexText() {
  const url =
    `${publicBaseUrl()}/${INDEX_PATH}?cb=` +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`index read failed (${res.status})`);
  return { body: await res.text(), etag: res.headers.get('etag') };
}

/* Returns [] when the index does not exist yet; throws on a decrypt failure
 * (callers that write must let it throw so a bad key never wipes data). */
async function readIndexState() {
  const text = await fetchIndexText();
  if (text === null) return { items: [], etag: null };
  const etag = text.etag;
  const sealed = Buffer.from(text.body, 'base64');
  if (sealed.length < 29) throw new Error('index corrupt');
  const d = crypto.createDecipheriv('aes-256-gcm', indexKey(), sealed.subarray(0, 12));
  d.setAuthTag(sealed.subarray(12, 28));
  const plain = Buffer.concat([d.update(sealed.subarray(28)), d.final()]).toString('utf8');
  const items = JSON.parse(plain);
  if (!Array.isArray(items)) throw new Error('index corrupt');
  return { items, etag };
}

async function readIndex() {
  return (await readIndexState()).items;
}

/* Read-modify-write with optimistic concurrency. The store is eventually
 * consistent (reads lag writes by a couple of seconds and can briefly serve
 * an older snapshot), so:
 *  - every save carries the ETag it was based on: if another write landed
 *    first the store rejects it with 412 and we retry on top of the fresh
 *    snapshot, so concurrent saves never silently drop a record;
 *  - a guard that finds nothing (record missing / wrong status) re-reads a few
 *    times before believing it, so a stale snapshot never turns a valid
 *    action into a 404.
 *
 * fn(items) -> { items: next | null, result }  (null = nothing to write) */
async function updateIndex(fn) {
  let guardMiss = 0;
  let conflicts = 0;
  let lastErr = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const { items, etag } = await readIndexState();
    const out = await fn(items);
    if (!out || !out.items) {
      if (out && guardMiss++ < 6) {
        await new Promise((r) => setTimeout(r, 400 + guardMiss * 200));
        continue;
      }
      return out ? out.result : undefined;
    }
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', indexKey(), iv);
    const ct = Buffer.concat([c.update(JSON.stringify(out.items), 'utf8'), c.final()]);
    const sealed = Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
    try {
      await put(INDEX_PATH, sealed, {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return out.result;
    } catch (e) {
      lastErr = e;
      const name = String((e && e.name) || '');
      const msg = String((e && e.message) || '');
      if (name === 'BlobPreconditionFailedError' || /if-match|precondition|412/i.test(msg)) {
        if (++conflicts > 10) break;
        // someone else wrote first — wait out the replication lag and retry
        await new Promise((r) => setTimeout(r, 350 + conflicts * 150));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`index is busy (${(lastErr && lastErr.message) || 'conflict'}) - try again`);
}

async function writeIndex(items) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', indexKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(items), 'utf8'), c.final()]);
  const sealed = Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
  await put(INDEX_PATH, sealed, {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

async function findBlob(pathname) {
  try {
    return await head(pathname);
  } catch {
    return null;
  }
}

async function removeBlob(pathname) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch {
    /* already gone */
  }
}

/* Public metadata record -> feed item shape used by the library grid. */
function toFeedItem(r) {
  const isVideo = String(r.contentType || '').startsWith('video/');
  return {
    id: `ws:${r.id}`,
    source: 'workshop',
    type: isVideo ? 'video' : 'image',
    title: r.title || 'Untitled',
    author: r.handle || 'Anonymous',
    pageUrl: r.url,
    thumb: r.url,
    full: r.url,
    width: 0,
    height: 0,
    nsfw: !!r.nsfw,
    tags: Array.isArray(r.tags) ? r.tags : [],
    category: (Array.isArray(r.tags) && r.tags[0]) || 'workshop',
    animated: isVideo || r.contentType === 'image/gif',
  };
}

module.exports = {
  KINDS,
  MAX_BYTES,
  json,
  readBody,
  parsePathname,
  cleanStr,
  cleanTags,
  readIndex,
  writeIndex,
  updateIndex,
  findBlob,
  removeBlob,
  toFeedItem,
};
