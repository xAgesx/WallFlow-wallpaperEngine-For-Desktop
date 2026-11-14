/* WallFlow key proxy (serverless function).
 *
 * Deploy this file to Vercel (or any Node host) and set the provider keys as
 * environment variables there. The desktop app then calls this endpoint with a
 * target API URL, and the proxy injects the matching key server-side, so no API
 * key ever ships inside the client.
 *
 * Requests look like:  GET /api/proxy?u=<urlencoded https api url>
 *
 * Only the provider hosts below are allowed, which also blocks SSRF to internal
 * addresses. The proxy itself holds no state and uses the global fetch (Node 18+).
 */

const PROVIDERS = {
  'wallhaven.cc': { env: 'WALLHAVEN_API_KEY', kind: 'query', param: 'apikey' },
  'pixabay.com': { env: 'PIXABAY_API_KEY', kind: 'query', param: 'key' },
  'tenor.googleapis.com': { env: 'TENOR_API_KEY', kind: 'query', param: 'key' },
  // Pexels expects the raw key as the Authorization header value
  'api.pexels.com': { env: 'PEXELS_API_KEY', kind: 'auth' },
  // Unsplash expects "Client-ID <access key>"
  'api.unsplash.com': { env: 'UNSPLASH_ACCESS_KEY', kind: 'client-id' },
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const raw = req.query && req.query.u;
  if (!raw || typeof raw !== 'string') {
    res.status(400).json({ error: 'missing target (u)' });
    return;
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).json({ error: 'invalid target url' });
    return;
  }
  if (target.protocol !== 'https:') {
    res.status(400).json({ error: 'only https targets are allowed' });
    return;
  }

  const provider = PROVIDERS[target.hostname];
  if (!provider) {
    res.status(403).json({ error: `host not allowed: ${target.hostname}` });
    return;
  }

  const key = process.env[provider.env];
  if (!key) {
    res.status(502).json({ error: `${provider.env} is not configured on the proxy` });
    return;
  }

  const headers = { 'User-Agent': 'WallFlow-Proxy/1.0', Accept: 'application/json' };
  if (provider.kind === 'query') target.searchParams.set(provider.param, key);
  else if (provider.kind === 'auth') headers.Authorization = key;
  else if (provider.kind === 'client-id') headers.Authorization = `Client-ID ${key}`;

  try {
    const upstream = await fetch(target.toString(), { headers });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: `upstream request failed: ${e && e.message ? e.message : e}` });
  }
};
