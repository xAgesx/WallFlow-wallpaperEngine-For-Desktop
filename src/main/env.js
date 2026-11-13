/* Minimal .env loader, zero dependencies.
   - Reads a .env file (KEY=VALUE lines, quotes and # comments supported)
   - Writes entries into process.env WITHOUT overriding variables that are
     already set, so real environment variables always win (shell, CI,
     Vercel dashboard).
   No electron imports: usable from plain node and portable to a server. */
const fs = require('fs');
const path = require('path');

function parse(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const first = value[0];
    if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash);
      value = value.trim();
    }
    out[m[1]] = value;
  }
  return out;
}

/* Loads envFile (default: .env at the project root) into process.env.
   Returns the variables the file contributed. */
function loadEnv(envFile) {
  const file = envFile || path.join(__dirname, '..', '..', '.env');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return {}; // no .env file: process.env only
  }
  const contributed = {};
  for (const [key, value] of Object.entries(parse(raw))) {
    if (key in process.env) continue; // deployment/shell env wins
    process.env[key] = value;
    contributed[key] = value;
  }
  return contributed;
}

module.exports = { loadEnv, parse };
