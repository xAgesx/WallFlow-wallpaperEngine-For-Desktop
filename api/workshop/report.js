/* Report an approved wallpaper: it hides for everyone at once and lands in the
 * admin queue as "reported". */
const { json, readBody, cleanStr, updateIndex } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method not allowed' });
    return;
  }
  const body = await readBody(req);
  const id = cleanStr(body && body.id, 40).toLowerCase();
  if (!id) {
    json(res, 400, { error: 'missing id' });
    return;
  }
  try {
    const reported = await updateIndex((items) => {
      const rec = items.find((i) => i.id === id);
      if (!rec || rec.status !== 'approved') return { items: null, result: false };
      rec.reports = (Number(rec.reports) || 0) + 1;
      rec.lastReason = cleanStr(body && body.reason, 200);
      rec.reportedAt = Date.now();
      rec.status = 'reported';
      return { items, result: true };
    });
    if (!reported) {
      json(res, 404, { error: 'not found' });
      return;
    }
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: String((e && e.message) || e) });
  }
};
