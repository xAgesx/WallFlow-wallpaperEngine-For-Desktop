/* Upload endpoint, two phases:
 *  1. token  - @vercel/blob client upload() posts a blob.generate-client-token
 *              event here; we constrain the token (type, size) and hand it back.
 *              The file bytes go straight from the client to the Blob store,
 *              bypassing the 4.5MB serverless body limit.
 *  2. confirm - after the upload lands, the client sends the wallpaper's
 *              metadata; we verify the blob and queue it as pending. */
const { handleUpload } = require('@vercel/blob/client');
const {
  KINDS,
  MAX_BYTES,
  json,
  readBody,
  parsePathname,
  cleanStr,
  cleanTags,
  updateIndex,
  findBlob,
} = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method not allowed' });
    return;
  }
  const body = await readBody(req);
  if (!body) {
    json(res, 400, { error: 'bad request body' });
    return;
  }

  /* phase 1: mint an upload token */
  if (typeof body.type === 'string' && body.type.startsWith('blob.')) {
    try {
      const result = await handleUpload({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        request: req,
        body,
        onBeforeGenerateToken: async (pathname) => {
          const parsed = parsePathname(pathname);
          if (!parsed) throw new Error('invalid upload path');
          const allowed = Object.keys(KINDS).filter((t) => KINDS[t].ext === parsed.ext);
          if (!allowed.length) throw new Error('unsupported file type');
          return {
            allowedContentTypes: allowed,
            maximumSizeInBytes: MAX_BYTES[parsed.kind],
            addRandomSuffix: false,
          };
        },
      });
      json(res, 200, result);
    } catch (e) {
      json(res, 400, { error: String((e && e.message) || e) });
    }
    return;
  }

  /* phase 2: verify the uploaded blob and queue the submission */
  if (body.action === 'confirm') {
    try {
      const parsed = parsePathname(body.pathname);
      if (!parsed || parsed.id !== cleanStr(body.id, 40).toLowerCase()) {
        json(res, 400, { error: 'invalid upload path' });
        return;
      }
      const blob = await findBlob(parsed.pathname);
      if (!blob) {
        json(res, 404, { error: 'upload not found' });
        return;
      }
      const info = KINDS[String(blob.contentType || '')];
      if (!info || info.ext !== parsed.ext) {
        json(res, 415, { error: 'unsupported content type' });
        return;
      }
      if (Number(blob.size) > MAX_BYTES[info.kind]) {
        json(res, 413, { error: 'file too large' });
        return;
      }

      const title = cleanStr(body.title, 80);
      const handle = cleanStr(body.handle, 32);
      if (!title) {
        json(res, 400, { error: 'title is required' });
        return;
      }
      if (!handle) {
        json(res, 400, { error: 'handle is required' });
        return;
      }

      const outcome = await updateIndex((items) => {
        if (items.some((i) => i.id === parsed.id)) return { items: null, result: 'dup' };
        items.push({
          id: parsed.id,
          title,
          handle,
          tags: cleanTags(body.tags),
          nsfw: !!body.nsfw,
          status: 'pending',
          createdAt: Date.now(),
          reports: 0,
          url: blob.url,
          pathname: parsed.pathname,
          contentType: String(blob.contentType || ''),
          size: Number(blob.size) || 0,
          kind: info.kind,
        });
        return { items, result: 'ok' };
      });
      if (outcome === 'dup') {
        json(res, 409, { error: 'already submitted' });
        return;
      }
      json(res, 200, { ok: true, id: parsed.id });
    } catch (e) {
      json(res, 500, { error: String((e && e.message) || e) });
    }
    return;
  }

  json(res, 400, { error: 'unknown action' });
};
