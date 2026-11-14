/* Public runtime configuration for WallFlow.
 *
 * PROXY_URL is the endpoint of the key proxy (see api/proxy.js). It is a
 * public URL, not a secret, and ships with the app so the client can reach the
 * proxy without bundling any API key. Leave it empty to call provider APIs
 * directly using local environment keys instead.
 *
 * The WALLFLOW_PROXY_URL environment variable overrides this value.
 */
module.exports = {
  PROXY_URL: '', // e.g. 'https://wallflow-proxy.vercel.app/api/proxy'
};
