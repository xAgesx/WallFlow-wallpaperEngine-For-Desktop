/* Public workshop feed: approved uploads, newest first. */
const { json, readIndex, toFeedItem } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'method not allowed' });
    return;
  }

  const q = String(req.query.q || '').trim().toLowerCase();
  const tag = String(req.query.tag || '').trim().toLowerCase();
  const nsfw = req.query.nsfw === '1' || req.query.nsfw === 'true';
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const size = Math.min(60, Math.max(1, parseInt(req.query.pageSize, 10) || 24));

  let items;
  try {
    items = await readIndex();
  } catch {
    // never break the feed; an unreadable index just looks empty
    json(res, 200, { items: [], hasMore: false, total: 0 });
    return;
  }

  items = items.filter((r) => r.status === 'approved' && (nsfw || !r.nsfw));
  if (q) {
    items = items.filter((r) =>
      `${r.title || ''} ${r.handle || ''} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q)
    );
  }
  if (tag) items = items.filter((r) => (r.tags || []).some((t) => t === tag));
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const start = page * size;
  const slice = items.slice(start, start + size).map(toFeedItem);

  // no edge caching: reports must hide wallpapers instantly and approvals
  // should show as soon as they happen (the index read is cheap)
  res.setHeader('Cache-Control', 'no-store');
  json(res, 200, { items: slice, hasMore: start + size < items.length, total: items.length });
};
