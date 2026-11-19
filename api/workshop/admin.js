/* Admin queue, guarded by the ADMIN_TOKEN secret.
 *   GET  ?status=queue|pending|reported|approved|rejected|all  (queue = default)
 *   POST { id, action: "approve" | "reject" }
 * reject also deletes the stored file (used for takedowns too). */
const crypto = require('crypto');
const { json, readBody, cleanStr, readIndex, updateIndex, removeBlob } = require('./_lib');

function authed(req) {
  const h = String(req.headers.authorization || '');
  const got = h.startsWith('Bearer ') ? h.slice(7) : String(req.headers['x-admin-token'] || '');
  const want = process.env.ADMIN_TOKEN || '';
  if (!got || !want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

module.exports = async (req, res) => {
  if (!authed(req)) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const status = String(req.query.status || 'queue');
      let items = await readIndex();
      if (status === 'queue') items = items.filter((i) => i.status === 'pending' || i.status === 'reported');
      else if (status !== 'all') items = items.filter((i) => i.status === status);
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      json(res, 200, { items });
    } catch (e) {
      json(res, 500, { error: String((e && e.message) || e) });
    }
    return;
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const id = cleanStr(body && body.id, 40).toLowerCase();
    const action = String((body && body.action) || '');
    if (!id || (action !== 'approve' && action !== 'reject')) {
      json(res, 400, { error: 'id and a valid action are required' });
      return;
    }
    try {
      const outcome = await updateIndex(async (items) => {
        const rec = items.find((i) => i.id === id);
        if (!rec) return { items: null, result: { code: 404, error: 'not found' } };
        if (action === 'approve') {
          if (rec.status !== 'pending' && rec.status !== 'reported') {
            return { items: null, result: { code: 400, error: `cannot approve a ${rec.status} item` } };
          }
          rec.status = 'approved';
          rec.approvedAt = Date.now();
          delete rec.reportedAt;
          delete rec.lastReason;
        } else {
          rec.status = 'rejected';
          rec.rejectedAt = Date.now();
          await removeBlob(rec.pathname); // idempotent; safe if a retry re-runs it
        }
        return { items, result: { code: 200, item: rec } };
      });
      json(res, outcome.code, outcome.code === 200 ? { ok: true, item: outcome.item } : { error: outcome.error });
    } catch (e) {
      json(res, 500, { error: String((e && e.message) || e) });
    }
    return;
  }

  json(res, 405, { error: 'method not allowed' });
};
