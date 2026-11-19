const UA = 'WallFlow/1.0 (desktop wallpaper engine)';

/* --- Optional key proxy -------------------------------------------------
 * When a proxy endpoint is configured (WALLFLOW_PROXY_URL env var, or
 * PROXY_URL in ./config.js), calls to keyed providers are routed through it
 * and the proxy injects the API key server-side, so the shipped client never
 * carries a provider key. With no proxy configured every provider behaves
 * exactly as before (direct calls using local env keys).
 * The value is read lazily because env is loaded after this module. */
function proxyBase() {
  const fromEnv = (process.env.WALLFLOW_PROXY_URL || '').trim();
  if (fromEnv) return fromEnv;
  try {
    return (require('./config').PROXY_URL || '').trim();
  } catch {
    return '';
  }
}

function proxyActive() {
  return !!proxyBase();
}

/* The workshop API (community uploads) runs beside the key proxy. */
function workshopBase() {
  const fromEnv = (process.env.WALLFLOW_WORKSHOP_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const base = proxyBase();
  if (!base) return '';
  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
}

/* Hosts the proxy is allowed to inject keys for. */
const PROXY_HOSTS = new Set([
  'wallhaven.cc',
  'api.pexels.com',
  'api.unsplash.com',
  'pixabay.com',
  'tenor.googleapis.com',
]);

/* Rewrite a keyed-provider URL to go through the proxy; pass others through. */
function viaProxy(url) {
  const base = proxyBase();
  if (!base) return url;
  try {
    const u = new URL(url);
    if (!PROXY_HOSTS.has(u.hostname)) return url;
    return `${base}${base.includes('?') ? '&' : '?'}u=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

/* A keyed provider is usable when we have a local key or a proxy will supply it. */
function keyed(localKey) {
  return !!localKey || proxyActive();
}

const WH_SORTS = new Set(['relevance', 'hot', 'date_added', 'top', 'random']);

const SOURCES = [
  {
    id: 'wallhaven',
    name: 'Wallhaven',
    description: 'Top-rated community wallpapers',
    types: ['image'],
    searchable: true,
    categories: ['general', 'anime', 'people'],
    sorts: ['hot', 'relevance', 'date_added', 'random'],
  },
  {
    id: 'wikimedia',
    name: 'Wikimedia',
    description: 'Featured photography & open video',
    types: ['image', 'video'],
    animated: true,
    searchable: true,
    categories: ['landscape', 'nature', 'architecture', 'space', 'ocean', 'city'],
    sorts: ['relevance'],
  },
  {
    id: 'nasa',
    name: 'NASA',
    description: 'Space imagery & mission video',
    types: ['image', 'video'],
    animated: true,
    searchable: true,
    categories: [],
    sorts: ['relevance'],
  },
  {
    id: 'pexels',
    name: 'Pexels',
    description: 'Stock photos & video clips',
    types: ['image', 'video'],
    animated: true,
    searchable: true,
    requiresKey: 'pexelsKey',
    categories: ['nature', 'architecture', 'travel', 'animals', 'food', 'people'],
    sorts: ['relevance', 'latest'],
  },
  {
    id: 'unsplash',
    name: 'Unsplash',
    description: 'High-end photography community',
    types: ['image'],
    searchable: true,
    requiresKey: 'unsplashKey',
    categories: ['nature', 'architecture', 'travel', 'animals', 'minimal', 'people'],
    sorts: ['relevance', 'latest'],
  },
  {
    id: 'pixabay',
    name: 'Pixabay',
    description: 'Photos, illustrations & clips',
    types: ['image', 'video'],
    animated: true,
    searchable: true,
    requiresKey: 'pixabayKey',
    categories: ['nature', 'architecture', 'travel', 'animals', 'fantasy', 'space'],
    sorts: ['relevance', 'latest'],
  },
  {
    id: 'motion',
    name: 'Motion',
    description: 'Looping video wallpapers',
    types: ['video'],
    animated: true,
    searchable: true,
    categories: ['nature', 'space', 'abstract', 'ocean'],
    sorts: ['relevance'],
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Safebooru scenery & art',
    types: ['image'],
    animated: true,
    searchable: true,
    categories: ['scenery', 'landscape', 'cityscape', 'sky', 'nature', 'night'],
    sorts: ['relevance'],
  },
  {
    id: 'konachan',
    name: 'Konachan',
    description: 'Anime wallpapers (safe-rated)',
    types: ['image'],
    animated: true,
    searchable: true,
    categories: ['landscape', 'cityscape', 'sky', 'nature', 'night'],
    sorts: ['relevance'],
  },
  {
    id: 'artic',
    name: 'Art Institute',
    description: 'Chicago open-access art',
    types: ['image'],
    searchable: true,
    categories: ['painting', 'photograph', 'print', 'drawing', 'manuscript'],
    sorts: ['relevance'],
  },
  {
    id: 'cleveland',
    name: 'Cleveland Museum',
    description: 'CMA open-access collection',
    types: ['image'],
    searchable: true,
    categories: ['painting', 'photograph', 'textile', 'print', 'drawing'],
    sorts: ['relevance'],
  },
  {
    id: 'met',
    name: 'The Met',
    description: 'Open access fine art',
    types: ['image'],
    searchable: true,
    categories: ['painting', 'photograph', 'landscape', 'drawing', 'print'],
    sorts: ['relevance'],
  },
  {
    id: 'tenor',
    name: 'Tenor GIFs',
    description: 'Animated GIF wallpapers',
    types: ['image'],
    animated: true,
    searchable: true,
    requiresKey: 'tenorKey',
    categories: ['nature', 'space', 'ocean', 'fire', 'abstract', 'anime'],
    sorts: ['relevance'],
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Wallpapers shared by WallFlow users',
    types: ['image', 'video'],
    animated: true,
    searchable: true,
    categories: [],
    sorts: ['relevance', 'date_added'],
  },
];

/* Content filter — one global vocabulary shared by every source */

const CONTENTS = [
  { id: 'anime', label: 'Anime' },
  { id: 'animals', label: 'Animals' },
  { id: 'space', label: 'Universe' },
  { id: 'nature', label: 'Nature' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'city', label: 'City' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'night', label: 'Night' },
  { id: 'fire', label: 'Fire' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'travel', label: 'Travel' },
];

/* Sources that can serve genuinely animated wallpapers */

const ANIMATED_SOURCES = new Set(SOURCES.filter((s) => s.animated).map((s) => s.id));

function isAnimatedItem(item) {
  if (!item) return false;
  if (item.type === 'video') return true;
  if (item.animated) return true;
  return /\.gif(\?|#|$)/i.test(String(item.full || item.thumb || ''));
}

/* ---------------- wallpaper-quality gate (SFW) ---------------- */

/*
 * A result has to actually work as a wallpaper: no photos of people and no
 * random objects/clutter. Anime is exempt — anime wallpapers may feature
 * characters. NSFW mode skips the gate entirely: it must stay unrestricted.
 */
const ANIME_SOURCES = new Set(['anime', 'konachan']);

/* every word also matches its plural: astronaut → astronauts, king → kings */
function wordsRe(words) {
  return '\\b(?:' + words.join('|') + ')(?:s|es)?\\b';
}

const PEOPLE_RE = new RegExp(
  wordsRe([
    'portrait', 'selfie',
    'man', 'men', 'woman', 'women', 'girl', 'boy',
    'person', 'people', 'human', 'face', 'smile',
    'couple', 'model', 'fashion', 'nude', 'naked',
    'body', 'hair', 'wedding', 'bride', 'groom', 'crowd',
    'actor', 'actress', 'celebrity',
    'child', 'children', 'kid', 'baby', 'family',
    'muscle', 'shirtless', 'handsome', 'cosplay',
    'lady', 'gentleman', 'guy',
    'princess', 'prince', 'king', 'queen', 'knight', 'warrior',
    'soldier', 'priest', 'bishop', 'emperor(?! ?penguin)', 'shepherd',
    'hunter', 'fisherman', 'peasant', 'rider', 'archer', 'maid',
    'servant', 'astronaut', 'cosmonaut',
    'suit', 'jacket', 'dress',
    // common non-English art-title words (museum/Wikimedia files)
    'ritratto', 'donna', 'femme', 'mujer', 'frau',
  ]),
  'i'
);

const CLUTTER_RE = new RegExp(
  wordsRe([
    // food & drink — close-up object shots
    'food', 'pizza', 'burger', 'sushi', 'cake', 'cookie', 'coffee',
    'breakfast', 'lunch', 'dinner', 'meal', 'dish', 'restaurant',
    'fruit', 'still life',
    // gadgets & products
    'laptop', 'smartphone', 'phone', 'computer', 'keyboard',
    'headphones', 'watch', 'shoe', 'bag', 'toy', 'doll',
    'coin', 'money', 'gift', 'bottle', 'book',
    // furniture & interiors
    'desk', 'chair', 'lamp', 'sofa',
    // graphics & clutter instead of scenery
    'diagram', 'chart', 'graph', 'map', 'logo', 'flag',
    'icon', 'emblem', 'screenshot', 'poster', 'text',
    'mechanism', 'blueprint', 'schematic', 'flowchart', 'demo',
  ]) + '|map[a-z0-9]+-ortho',
  'i'
);

/*
 * Titles like "AfricanAmericanAstronauts-24x36poster" hide plain words inside
 * CamelCase and digit runs — split those apart before matching.
 */
function gateText(item) {
  const raw = `${item.title || ''} ${Array.isArray(item.tags) ? item.tags.join(' ') : ''}`;
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([a-z])/g, '$1 $2')
    .toLowerCase();
}

function isWallpaperLike(item) {
  if (!item) return false;
  if (ANIME_SOURCES.has(item.source) || item.category === 'anime') return true;
  const text = gateText(item);
  if (PEOPLE_RE.test(text)) return false;
  if (CLUTTER_RE.test(text)) return false;
  return true;
}

const CURATED_VIDEOS = [
  {
    id: 'vid-bbb',
    title: 'Big Buck Bunny',
    full: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_10MB.mp4',
    pageUrl: 'https://test-videos.co.uk/',
    width: 1280,
    height: 720,
  },
  {
    id: 'vid-sintel',
    title: 'Sintel',
    full: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_10MB.mp4',
    pageUrl: 'https://test-videos.co.uk/',
    width: 1280,
    height: 720,
  },
  {
    id: 'vid-elephants',
    title: 'Elephants Dream',
    full: 'https://test-videos.co.uk/vids/elephantsdream/mp4/h264/720/Elephants_Dream_720_10s_10MB.mp4',
    pageUrl: 'https://test-videos.co.uk/',
    width: 1280,
    height: 720,
  },
  {
    id: 'vid-bunny-small',
    title: 'Bunny Loop',
    full: 'https://www.w3schools.com/html/mov_bbb.mp4',
    pageUrl: 'https://www.w3schools.com/html/html5_video.asp',
    width: 560,
    height: 320,
  },
  {
    id: 'vid-forbigger',
    title: 'For Bigger Blazes',
    full: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    pageUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/',
    width: 1280,
    height: 720,
  },
  {
    id: 'vid-escape',
    title: 'Escape',
    full: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Escape.mp4',
    pageUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/',
    width: 1280,
    height: 720,
  },
];

/* ---------------- HTTP + cache ---------------- */

async function getJson(url, { timeout = 25000, headers = {} } = {}) {
  const target = viaProxy(url);
  const proxied = target !== url;
  const send = { ...headers };
  // the proxy injects its own provider auth — never forward a local key header
  if (proxied) delete send.Authorization;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': UA, Accept: 'application/json', ...send },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url.split('?')[0]})`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getText(url, { timeout = 20000, headers = {} } = {}) {
  const target = viaProxy(url);
  const proxied = target !== url;
  const send = { ...headers };
  if (proxied) delete send.Authorization;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': UA, ...send },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url.split('?')[0]})`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.value;
  cache.delete(key);
  return null;
}

function cacheSet(key, value) {
  cache.set(key, { ts: Date.now(), value });
  if (cache.size > 120) cache.delete(cache.keys().next().value);
}

/* ---------------- pagination engine ----------------
 * Each source exposes fetchServerPage(serverPage, ctx) -> { items, hasMore, meta? }
 * paginate() accumulates server pages into one list and slices it into app pages.
 */

async function paginate(key, fetchServerPage, page, size) {
  let entry = cacheGet(key);
  if (!entry || !Array.isArray(entry.items)) {
    entry = { items: [], serverPages: 0, hasMore: true, meta: {} };
  }
  const need = (page + 1) * size;
  let guard = 0;
  let lastError = null;
  let consecutiveEmpty = 0;
  while (entry.items.length < need && entry.hasMore && guard++ < 15) {
    try {
      const res = await fetchServerPage(entry.serverPages, entry.meta);
      entry.serverPages += 1;
      if (res.items && res.items.length) {
        consecutiveEmpty = 0;
        const seen = new Set(entry.items.map((i) => i.id));
        for (const it of res.items) if (!seen.has(it.id)) entry.items.push(it);
      } else {
        consecutiveEmpty += 1;
      }
      if (res.meta) Object.assign(entry.meta, res.meta);
      entry.hasMore = !!res.hasMore;
      if (consecutiveEmpty >= 3) {
        entry.hasMore = false;
        break;
      }
      if (!res.items || !res.items.length) continue;
    } catch (e) {
      lastError = e;
      break;
    }
  }
  // never cache empty entries — they would poison later retries
  if (entry.items.length > 0) cacheSet(key, entry);
  if (lastError && entry.items.length === 0) throw lastError;
  const start = page * size;
  return {
    items: entry.items.slice(start, start + size),
    hasMore: entry.hasMore || entry.items.length > start + size,
    ...(lastError ? { partial: true } : {}),
  };
}

function orientationOf(w, h) {
  return h > w ? 'portrait' : 'landscape';
}

function applyCommonFilters(items, filters) {
  let out = items;
  if (filters.orientation && filters.orientation !== 'all') {
    out = out.filter((i) => !i.width || orientationOf(i.width, i.height) === filters.orientation);
  }
  if (filters.minWidth) out = out.filter((i) => !i.width || i.width >= filters.minWidth);
  return out;
}

/* ---------------- Wallhaven ---------------- */

async function fetchWallhaven(serverPage, ctx) {
  const { query, filters } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  // wallhaven has native categories general/anime/people; other content terms become tag queries
  const whCat = ['general', 'anime', 'people'].includes(cat) ? cat : '';
  const q = [query, whCat ? '' : cat].filter(Boolean).join(' ').trim();

  // wallhaven returns 0 results for empty queries unless a working sort is used
  let sorting = filters.sort && WH_SORTS.has(filters.sort) ? filters.sort : 'hot';
  if (sorting === 'top') sorting = 'hot';
  if (!q && sorting === 'relevance') sorting = 'hot';
  if (q && sorting === 'hot') sorting = 'relevance';

  const params = new URLSearchParams({
    // NSFW = unrestricted (all purities); SFW stays safe-only
    purity: filters.nsfw ? '111' : '100',
    // SFW never serves the people category — photos of people aren't wallpapers
    categories: filters.nsfw
      ? whCat
        ? ['general', 'anime', 'people'].map((c) => (c === whCat ? '1' : '0')).join('')
        : '111'
      : whCat && whCat !== 'people'
        ? ['general', 'anime', 'people'].map((c) => (c === whCat ? '1' : '0')).join('')
        : '110',
    sorting,
    order: 'desc',
    page: String(serverPage + 1),
  });
  if (q) params.set('q', q);
  if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
  if (filters.minWidth) params.set('atleast', `${filters.minWidth}x${Math.round((filters.minWidth * 9) / 16)}`);
  if (filters.keys && filters.keys.wallhavenKey) params.set('apikey', filters.keys.wallhavenKey);

  let json = await getJson(`https://wallhaven.cc/api/v1/search?${params}`);
  if (serverPage === 0 && !(json.data || []).length) {
    // ride out transient rate-limits: one retry after a short pause
    await new Promise((r) => setTimeout(r, 700));
    json = await getJson(`https://wallhaven.cc/api/v1/search?${params}`);
  }
  const items = (json.data || []).map((d) => ({
    id: `wallhaven:${d.id}`,
    source: 'wallhaven',
    type: 'image',
    title: d.source || `Wallhaven ${d.id}`,
    author: d.source || 'wallhaven',
    pageUrl: d.url,
    thumb: d.thumbs && d.thumbs.large,
    full: d.path,
    width: d.dimension_x,
    height: d.dimension_y,
    category: d.category,
    nsfw: d.purity === 'nsfw',
    tags: [],
  }));
  const meta = json.meta || {};
  return {
    items,
    hasMore: meta.last_page ? meta.current_page < meta.last_page : items.length > 0,
  };
}

/* ---------------- NASA (images, or real video when animated-only) ---------------- */

async function fetchNasa(serverPage, ctx) {
  const { query, filters } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim() || 'nebula';

  if (filters.animatedOnly) {
    const json = await getJson(
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=video&page=${serverPage + 1}`
    );
    const raw = (json.collection && json.collection.items) || [];
    // resolving the asset manifest costs one extra request per clip — cap it per page
    const resolved = await Promise.all(
      raw.slice(0, 10).map(async (it) => {
        const d = (it.data && it.data[0]) || {};
        try {
          const manifest = await getJson(it.href, { timeout: 9000 });
          const files = Array.isArray(manifest) ? manifest : [];
          const mp4s = files.filter((u) => /\.mp4(\?|$)/i.test(u));
          const full =
            mp4s.find((u) => /~medium\.mp4/i.test(u)) ||
            mp4s.find((u) => /~large\.mp4/i.test(u)) ||
            mp4s.find((u) => /~orig\.mp4/i.test(u)) ||
            mp4s[0];
          if (!full) return null;
          return {
            id: `nasa:${d.nasa_id || Math.random().toString(36).slice(2)}`,
            source: 'nasa',
            type: 'video',
            title: d.title || 'NASA',
            author: d.center || 'NASA',
            pageUrl: `https://images.nasa.gov/details/${d.nasa_id}`,
            thumb: (it.links && it.links[0] && it.links[0].href) || null,
            full: full.replace(/^http:\/\//, 'https://'),
            width: 0,
            height: 0,
            category: 'space',
            tags: (d.keywords || []).slice(0, 6),
            animated: true,
          };
        } catch {
          return null;
        }
      })
    );
    const pages = json.collection && json.collection.pages;
    return {
      items: resolved.filter(Boolean),
      hasMore: pages ? serverPage + 1 < pages : raw.length >= 100,
    };
  }

  if (serverPage > 0) return { items: [], hasMore: false };
  const json = await getJson(
    `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image`
  );
  const raw = (json.collection && json.collection.items) || [];
  const items = raw.slice(0, 240).map((it) => {
    const d = (it.data && it.data[0]) || {};
    const link = (it.links && it.links[0] && it.links[0].href) || '';
    const full = link.replace(/~thumb\./, '~orig.').replace(/~small\./, '~orig.');
    return {
      id: `nasa:${d.nasa_id || Math.random().toString(36).slice(2)}`,
      source: 'nasa',
      type: 'image',
      title: d.title || 'NASA',
      author: d.center || 'NASA',
      pageUrl: `https://images.nasa.gov/details/${d.nasa_id}`,
      thumb: link,
      full: full || link,
      width: 0,
      height: 0,
      category: 'space',
      tags: (d.keywords || []).slice(0, 6),
    };
  });
  return { items, hasMore: false };
}

/* ---------------- Wikimedia (curated quality images by default) ---------------- */

/*
 * CirrusSearch term negations keep diagrams, maps, flags, screenshots and
 * non-photographic files (interviews, scientific plates, drawings, scans)
 * out of the results. A negation the user actually searched for is dropped
 * so a query like "map of iceland" can't self-eliminate.
 *
 * Commons hard-caps the search string at 300 characters and answers longer
 * queries with a JSON-level error, so the list is ordered by value and
 * trimmed to the budget that is left after the query itself.
 */
const WIKI_NEGATIVE_TERMS = [
  // interviews, talks & broadcast footage — the usual offenders
  '-interview', '-lecture', '-conference', '-seminar', '-speech',
  '-trailer', '-documentary', '-review', '-tutorial', '-gameplay',
  '-advertisement', '-news', '-concert', '-rehearsal',
  // drawings, prints & scientific illustrations instead of photographs
  '-illustration', '-drawing', '-sketch', '-engraving', '-painting',
  '-watercolor', '-specimen', '-anatomy', '-micrograph', '-histology',
  // classic non-photo graphics (short terms, high value)
  '-map', '-diagram', '-chart', '-screenshot', '-logo',
  '-flag', '-icon', '-emblem', '-text', '-portrait',
  // documents, signage & printed matter
  '-document', '-poster', '-scan', '-infographic', '-collage',
  '-manuscript', '-certificate', '-newspaper',
  // small collectible objects & fonts that only work as macro shots
  '-stamp', '-banknote', '-coin', '-plaque', '-font',
  '-typeface', '-glyph', '-watermark',
  // the rest — used whenever the query is short enough to fit them
  '-etching', '-woodcut', '-lithograph', '-print', '-fossil',
  '-equation', '-vlog', '-episode', '-commentary', '-karaoke',
  '-walkthrough', '-recording', '-music', '-anthem', '-broadcast',
  '-science', '-institute',
];

/* Commons CirrusSearch limit: 300 chars for the search string (the
   filetype:/incategory: filter words themselves are exempt). */
const WIKI_QUERY_MAX = 300;

function wikiBudget(prefix, core) {
  // prefix + core + ' ' + negations <= 300, minus a small safety margin
  return Math.max(0, WIKI_QUERY_MAX - prefix.length - String(core || '').length - 3);
}

function wikiNegations(query, budget = WIKI_QUERY_MAX) {
  const words = new Set(String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const out = [];
  let len = 0;
  for (const n of WIKI_NEGATIVE_TERMS) {
    if (words.has(n.slice(1))) continue;
    const add = n.length + (out.length ? 1 : 0);
    if (len + add > budget) break; // list is priority-ordered: keep the top terms
    out.push(n);
    len += add;
  }
  return out.join(' ');
}

/* Wikimedia reports API-level failures as JSON with HTTP 200 — surface them
   so a bad query fails loudly instead of silently returning an empty page. */
async function getWikiJson(url, opts) {
  const json = await getJson(url, opts);
  if (json && json.error) {
    throw new Error(`wikimedia: ${json.error.code || json.error.info || 'api error'}`);
  }
  return json;
}

/*
 * Second line of defense: titles the query negations can't catch (word
 * variants, compound names). Applied to every wikimedia item — curated
 * category picks included — so people, documents and scientific figures
 * never reach the grid. Returns true when the title looks like a wallpaper.
 */
const WIKI_JUNK_RE = new RegExp(
  wordsRe([
    // broadcast & event footage instead of scenery
    'interview', 'lecture', 'conference', 'seminar', 'symposium',
    'keynote', 'webinar', 'panel discussion', 'press conference',
    // artwork & scientific plates instead of photographs
    'illustration', 'drawing', 'sketch', 'engraving', 'etching',
    'woodcut', 'lithograph', 'watercolor', 'watercolour', 'painting',
    'specimen', 'anatomy', 'anatomical', 'histology', 'micrograph',
    'microscope', 'equation', 'theorem', 'infographic',
    'collage', 'montage', 'cartoon', 'diagram', 'schematic',
    'flowchart', 'blueprint',
    // simulations, demos & data figures (scientific GIF/video fodder)
    'simulation', 'experiment', 'demonstration', 'laboratory',
    'example', 'reduction', 'isochron', 'crust',
    'animation', 'breakup', 'visualization', 'mosaic',
    // documents & printed matter
    'manuscript', 'parchment', 'scan', 'screenshot', 'screen capture',
    'document', 'letter', 'certificate', 'diploma', 'newspaper',
    'poster', 'advertisement', 'billboard', 'clipart',
    'font', 'typeface', 'glyph', 'watermark', 'chart', 'news',
    // small collectible objects that only work as macro shots
    'stamp', 'banknote', 'currency', 'coin',
    // heraldry
    'plaque', 'coat of arms', 'heraldry', 'blazon', 'seal of', 'great seal',
    // signage & graphics over scenery
    'sign', 'figure', 'plate',
    // satellite & weather data animations
    'satellite', 'seaice', 'sea ice', 'greenhouse', 'precipitable',
    'intensifying', 'cyclone', 'tpw', 'radiance',
    'stratocumulus', 'eddies', 'cira',
    // disasters read as news photos, not wallpapers
    'wildfire', 'forest fire', 'flood', 'flooding',
  ]),
  'i'
);

/* A year range ("Aral sea 2000-2009") or a run of years ("for 2005, 2006,
   2007") almost always means a data timelapse rather than a photograph. */
const WIKI_YEAR_RANGE_RE =
  /\b(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}\b|\b(?:19|20)\d{2}[,;]?\s+(?:19|20)\d{2}[,;]?\s+(?:19|20)\d{2}\b/;

/* Resolution floor — wallpapers below ~1600px wide look soft on modern screens. */
const WIKI_MIN_WIDTH = 1600;

/*
 * Music-show / idol footage leaks into video results whenever a group name
 * matches the query (the group "Nature" ranks for "nature"). English wordsRe
 * can't match Korean titles, so those get a plain substring blocklist.
 */
const WIKI_JUNK_SUBSTRINGS = [
  '리허설', '출근길', '직캠', '뮤직뱅크', '음악중심', '인기가요',
  '컴백', '포토타임', '공개녹화', 'fancam', 'dance practice',
];

function wikiTitleIsJunk(title) {
  const text = gateText({ title, tags: [] });
  if (WIKI_JUNK_RE.test(text)) return true;
  if (WIKI_YEAR_RANGE_RE.test(text)) return true;
  const lower = String(title || '').toLowerCase();
  return WIKI_JUNK_SUBSTRINGS.some((s) => lower.includes(s));
}

function mapWikiPage(p) {
  const info = (p.imageinfo && p.imageinfo[0]) || {};
  if (!info.thumburl && !info.url) return null;
  if (info.width && info.width < WIKI_MIN_WIDTH && info.height < WIKI_MIN_WIDTH) return null;
  const title = (p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
  if (wikiTitleIsJunk(title)) return null;
  const big = info.thumburl || info.url;
  const thumb = big.replace(/\/\d+px-/, '/400px-');
  return {
    id: `wikimedia:${p.pageid}`,
    source: 'wikimedia',
    type: 'image',
    title,
    author: 'Wikimedia Commons',
    pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
    thumb,
    full: big,
    width: info.width || 0,
    height: info.height || 0,
    category: 'photo',
    tags: [],
  };
}

/* Shared video mapper — same junk/resolution bar for the wikimedia source
   and the Commons videos inside the motion feed. */
function mapWikiVideo(p, source = 'wikimedia') {
  const info = (p.imageinfo && p.imageinfo[0]) || {};
  if (!info.url || !/webm|mp4|ogv/i.test(info.mime || '')) return null;
  if (info.width && info.width < WIKI_MIN_WIDTH && info.height < WIKI_MIN_WIDTH) return null;
  const title = (p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
  if (wikiTitleIsJunk(title)) return null;
  return {
    id: `wikimedia:${p.pageid}`,
    source,
    type: 'video',
    title,
    // Commons clips pulled in by other sources (motion) must not read as the
    // Wikimedia source itself — users disable that source by name
    author: source === 'wikimedia' ? 'Wikimedia Commons' : 'Commons',
    pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
    thumb: info.thumburl || null,
    full: info.url,
    width: info.width || 0,
    height: info.height || 0,
    category: 'video',
    tags: [],
    animated: true,
  };
}

/* Curated quality categories for the no-query feed — verified to exist on
   Commons; the feed rotates so every session shows different scenery. */
const WIKI_CATEGORIES = [
  'Quality_images_of_landscapes',
  'Quality_images_of_mountains',
  'Quality_images_of_seas',
  'Quality_images_of_forests',
  'Quality_images_of_rivers',
  'Quality_images_of_lakes',
  'Quality_images_of_sunsets',
  'Quality_images_of_clouds',
  'Quality_images_of_waterfalls',
];

async function fetchWikimedia(serverPage, ctx) {
  const { query, filters, meta } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim();

  if (filters.animatedOnly) {
    // open video (webm/mp4) from Commons — the animated counterpart of this source
    const core = q || 'nature';
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&' +
      'generator=search&gsrnamespace=6&gsrlimit=30&' +
      `gsroffset=${serverPage * 30}&` +
      `gsrsearch=${encodeURIComponent(`filetype:video ${core} ${wikiNegations(q, wikiBudget('filetype:video ', core))}`)}&` +
      'prop=imageinfo&iiprop=url|size|mime&iiurlwidth=640';
    const json = await getWikiJson(url);
    const pages = (json.query && json.query.pages) || {};
    const items = Object.values(pages).map((p) => mapWikiVideo(p, 'wikimedia')).filter(Boolean);
    return { items, hasMore: !!json.continue || items.length === 30 };
  }

  if (!query && !cat) {
    // curated feed: Commons Quality images — rotates through scenery
    // categories so repeat sessions don't show the same landscape list
    if (!meta.wikiCat) {
      meta.wikiTried = [];
      meta.wikiCat = WIKI_CATEGORIES[Math.floor(Math.random() * WIKI_CATEGORIES.length)];
      meta.wikiTried.push(meta.wikiCat);
    }
    let url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&' +
      'generator=categorymembers&gcmtype=file&gcmlimit=40&' +
      `gcmtitle=Category%3A${meta.wikiCat}&` +
      'prop=imageinfo&iiprop=url|size|mime&iiurlwidth=2560';
    if (meta.gcmcontinue) url += `&gcmcontinue=${encodeURIComponent(meta.gcmcontinue)}`;
    const json = await getWikiJson(url);
    const pages = (json.query && json.query.pages) || {};
    const items = Object.values(pages).map(mapWikiPage).filter(Boolean);
    const cont = (json.continue && json.continue.gcmcontinue) || null;
    if (cont) {
      meta.gcmcontinue = cont;
      return { items, hasMore: true };
    }
    // category exhausted: queue the next untried one for the following page
    meta.gcmcontinue = null;
    const rest = WIKI_CATEGORIES.filter((c) => !meta.wikiTried.includes(c));
    if (rest.length) {
      meta.wikiCat = rest[Math.floor(Math.random() * rest.length)];
      meta.wikiTried.push(meta.wikiCat);
      return { items, hasMore: true };
    }
    return { items, hasMore: false };
  }

  const core = q || 'landscape';
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&' +
    'generator=search&gsrnamespace=6&gsrlimit=40&' +
    `gsroffset=${serverPage * 40}&` +
    `gsrsearch=${encodeURIComponent(`filetype:bitmap ${core} ${wikiNegations(q, wikiBudget('filetype:bitmap ', core))}`)}&` +
    'prop=imageinfo&iiprop=url|size|mime&iiurlwidth=2560';
  const json = await getWikiJson(url);
  const pages = (json.query && json.query.pages) || {};
  const items = Object.values(pages).map(mapWikiPage).filter(Boolean);
  return { items, hasMore: !!json.continue || items.length === 40 };
}

/* ---------------- Art Institute ---------------- */

async function fetchArtic(serverPage, ctx) {
  const { query, filters } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim() || 'landscape';
  const url =
    'https://api.artic.edu/api/v1/artworks/search?limit=60&' +
    `q=${encodeURIComponent(q)}&` +
    'fields=id,title,image_id,artist_display,date_display,artwork_type_title&' +
    `offset=${serverPage * 60}`;
  const json = await getJson(url);
  const items = (json.data || [])
    .filter((d) => d.image_id)
    .map((d) => ({
      id: `artic:${d.id}`,
      source: 'artic',
      type: 'image',
      title: d.title || 'Untitled',
      author: (d.artist_display || '').split('\n')[0] || 'Art Institute Chicago',
      pageUrl: `https://www.artic.edu/artworks/${d.id}`,
      thumb: `https://www.artic.edu/iiif/2/${d.image_id}/full/400,/0/default.jpg`,
      full: `https://www.artic.edu/iiif/2/${d.image_id}/full/1686,/0/default.jpg`,
      width: 0,
      height: 0,
      category: (d.artwork_type_title || 'art').toLowerCase(),
      tags: [d.date_display].filter(Boolean),
    }));
  const total = json.pagination && json.pagination.total;
  return { items, hasMore: total ? (serverPage + 1) * 60 < total : items.length === 60 };
}

/* ---------------- Cleveland Museum ---------------- */

async function fetchCleveland(serverPage, ctx) {
  const { query, filters } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim() || 'landscape';
  const url =
    'https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&limit=60&' +
    `skip=${serverPage * 60}&q=${encodeURIComponent(q)}`;
  const json = await getJson(url);
  const items = (json.data || [])
    .filter((d) => d.images && d.images.web && d.images.web.url)
    .map((d) => ({
      id: `cleveland:${d.id}`,
      source: 'cleveland',
      type: 'image',
      title: d.title || 'Untitled',
      author:
        (d.creators && d.creators[0] && d.creators[0].description) || 'Cleveland Museum of Art',
      pageUrl: d.url,
      thumb: d.images.web.url,
      full: (d.images.print && d.images.print.url) || d.images.web.url,
      width: Number((d.images.print && d.images.print.width) || 0),
      height: Number((d.images.print && d.images.print.height) || 0),
      category: 'art',
      tags: [d.creation_date, d.technique].filter(Boolean).slice(0, 4),
    }));
  const total = json.info && json.info.total;
  return { items, hasMore: total ? (serverPage + 1) * 60 < total : items.length === 60 };
}

/* ---------------- The Met ---------------- */

async function fetchMet(serverPage, ctx) {
  const { query, filters, meta } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim() || 'landscape';
  if (!meta.objectIDs || serverPage === 0) {
    const searchUrl =
      'https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&q=' +
      encodeURIComponent(q);
    const json = await getJson(searchUrl);
    meta.objectIDs = json.objectIDs || [];
  }
  const ids = meta.objectIDs.slice(serverPage * 40, serverPage * 40 + 40);
  if (!ids.length) return { items: [], hasMore: false };

  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < ids.length) {
      const id = ids[idx++];
      try {
        const obj = await getJson(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
          { timeout: 12000 }
        );
        if (obj.primaryImageSmall) {
          results.push({
            id: `met:${id}`,
            source: 'met',
            type: 'image',
            title: obj.title || 'Untitled',
            author: obj.artistDisplayName || obj.department || 'The Met',
            pageUrl: obj.objectURL,
            thumb: obj.primaryImageSmall,
            full: obj.primaryImage || obj.primaryImageSmall,
            width: 0,
            height: 0,
            category: (obj.objectName || '').toLowerCase(),
            tags: [obj.medium, obj.objectDate].filter(Boolean).slice(0, 4),
          });
        }
      } catch {
        /* skip */
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  results.sort(
    (a, b) =>
      ids.indexOf(Number(a.id.split(':')[1])) - ids.indexOf(Number(b.id.split(':')[1]))
  );
  return { items: results, hasMore: (serverPage + 1) * 40 < meta.objectIDs.length };
}

/* ---------------- Anime (Safebooru) ---------------- */

/* content id -> booru tag; booru tags that don't exist simply yield fewer results */
const BOORU_TAG = {
  anime: '',
  animals: 'animals',
  universe: 'space',
  space: 'space',
  nature: 'nature',
  landscape: 'landscape',
  ocean: 'ocean',
  city: 'city',
  architecture: 'architecture',
  night: 'night',
  fire: 'fire',
  abstract: 'abstract',
  fantasy: 'fantasy',
  travel: 'travel',
};

function booruTagFor(cat) {
  if (!cat || cat === 'all') return '';
  return BOORU_TAG[cat] !== undefined ? BOORU_TAG[cat] : cat;
}

function booruMedia(p) {
  const file = String(p.file_url || '');
  const ext = (file.match(/\.([a-z0-9]+)(?:\?|$)/i) || [])[1] || '';
  const isVideo = /^(mp4|webm|mov|m4v)$/i.test(ext);
  const isGif = /^gif$/i.test(ext);
  return { file, ext, isVideo, isGif };
}

async function fetchAnime(serverPage, ctx) {
  const { query, filters } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const nsfwOn = !!filters.nsfw;
  const tag = booruTagFor(cat);
  // NSFW drops every constraint — safebooru has no explicit tier, but nothing is capped
  const base =
    [query, tag, nsfwOn ? '' : 'scenery'].filter(Boolean).join(' ').trim() ||
    (nsfwOn ? '' : 'scenery');
  // animated-only: booru `animated` tag = real GIF/video posts
  const q = (filters.animatedOnly ? `${base} animated`.trim() : base) || '';
  const url =
    'https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=40' +
    `&pid=${serverPage}&tags=${encodeURIComponent(q)}`;
  const json = await getJson(url);
  const items = (Array.isArray(json) ? json : [])
    .filter((p) => nsfwOn || !p.rating || p.rating === 'general' || p.rating === 'safe')
    .map((p) => {
      const media = booruMedia(p);
      const animated = media.isVideo || media.isGif;
      return {
        id: `anime:${p.id}`,
        source: 'anime',
        type: media.isVideo ? 'video' : 'image',
        title: (p.tags || '').split(' ').slice(0, 3).join(' · ') || 'Anime scenery',
        author: p.owner || 'safebooru',
        pageUrl: `https://safebooru.org/index.php?page=post&s=view&id=${p.id}`,
        thumb: p.preview_url,
        // sample_url is a still frame for animated posts — use the real file
        full: animated ? media.file : p.sample_url || media.file,
        width: p.width || 0,
        height: p.height || 0,
        category: 'anime',
        nsfw: p.rating === 'questionable' || p.rating === 'explicit',
        tags: (p.tags || '').split(' ').slice(0, 8),
        animated,
      };
    });
  return { items, hasMore: items.length === 40 };
}

/* ---------------- Konachan (anime wallpapers; safe mirror, or unrestricted when NSFW) ---------------- */

async function fetchKonachan(serverPage, ctx) {
  const { query, filters } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  // NSFW switches to the .com mirror, which serves explicit posts keyless;
  // the .net mirror is safe-rated only, so SFW keeps its rating cap
  const host = filters.nsfw ? 'konachan.com' : 'konachan.net';
  const terms = [
    query,
    booruTagFor(cat),
    filters.nsfw ? '' : 'rating:safe',
    filters.animatedOnly ? 'animated' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const url = `https://${host}/post.json?tags=${encodeURIComponent(terms)}&limit=40&pid=${serverPage}`;
  const json = await getJson(url);
  const arr = Array.isArray(json) ? json : [];
  const items = arr.map((p) => {
    const media = booruMedia(p);
    const animated = media.isVideo || media.isGif;
    return {
      id: `konachan:${p.id}`,
      source: 'konachan',
      type: media.isVideo ? 'video' : 'image',
      title: String(p.tags || '').split(' ').slice(0, 3).join(' · ') || 'Anime wallpaper',
      author: 'Konachan',
      pageUrl: `https://${host}/post/show/${p.id}`,
      thumb: p.preview_url || null,
      full: animated ? media.file : p.sample_url || media.file,
      width: p.width || 0,
      height: p.height || 0,
      category: 'anime',
      nsfw: p.rating !== 's',
      tags: String(p.tags || '').split(' ').slice(0, 8),
      animated,
    };
  });
  return { items, hasMore: arr.length === 40 };
}

/* ---------------- Pexels ---------------- */

async function fetchPexels(serverPage, ctx) {
  const { query, filters } = ctx;
  const apiKey = filters.keys && filters.keys.pexelsKey;
  if (!keyed(apiKey)) throw new Error('Pexels API key missing — add a key or enable the key proxy');
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim() || 'wallpaper';

  if (filters.animatedOnly) {
    const params = new URLSearchParams({
      query: q,
      page: String(serverPage + 1),
      per_page: '40',
    });
    if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
    const json = await getJson(`https://api.pexels.com/videos/search?${params}`, {
      headers: { Authorization: apiKey },
    });
    const items = (json.videos || [])
      .map((v) => {
        const files = (v.video_files || [])
          .filter((f) => f.link && /mp4/i.test(f.link || ''))
          .sort((a, b) => Math.abs((a.height || 0) - 1080) - Math.abs((b.height || 0) - 1080));
        const best = files[0];
        if (!best) return null;
        // the URL slug is the only descriptive text the video API returns —
        // it turns "Pexels clip" into filterable titles like "a woman dancing"
        const slug = String(v.url || '').split('/').filter(Boolean).pop() || '';
        const slugTitle = slug.replace(/-\d+$/, '').replace(/-/g, ' ').trim();
        return {
          id: `pexels-video:${v.id}`,
          source: 'pexels',
          type: 'video',
          title: slugTitle ? slugTitle.charAt(0).toUpperCase() + slugTitle.slice(1) : 'Pexels clip',
          author: 'Pexels',
          pageUrl: v.url,
          thumb: (v.video_pictures && v.video_pictures[0] && v.video_pictures[0].picture) || null,
          full: best.link,
          width: v.width || 0,
          height: v.height || 0,
          category: 'video',
          tags: [],
          animated: true,
        };
      })
      .filter(Boolean);
    const total = json.total_results || 0;
    return { items, hasMore: (serverPage + 1) * 40 < total };
  }

  const params = new URLSearchParams({
    query: q,
    page: String(serverPage + 1),
    per_page: '80',
  });
  if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
  const json = await getJson(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });
  const items = (json.photos || []).map((p) => ({
    id: `pexels:${p.id}`,
    source: 'pexels',
    type: 'image',
    title: p.alt || 'Pexels photo',
    author: p.photographer || 'Pexels',
    pageUrl: p.url,
    thumb: p.src && (p.src.medium || p.src.small),
    full: p.src && (p.src.original || p.src.large2x),
    width: p.width,
    height: p.height,
    category: 'photo',
    tags: [],
  }));
  const total = json.total_results || 0;
  return { items, hasMore: (serverPage + 1) * 80 < total };
}

/* ---------------- Unsplash ---------------- */

async function fetchUnsplash(serverPage, ctx) {
  const { query, filters } = ctx;
  const apiKey = filters.keys && filters.keys.unsplashKey;
  if (!keyed(apiKey)) throw new Error('Unsplash API key missing — add a key or enable the key proxy');
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim() || 'wallpaper';
  const params = new URLSearchParams({
    query: q,
    page: String(serverPage + 1),
    per_page: '30',
  });
  if (filters.sort === 'latest') params.set('order_by', 'latest');
  if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
  const json = await getJson(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${apiKey}` },
  });
  const items = (json.results || []).map((p) => ({
    id: `unsplash:${p.id}`,
    source: 'unsplash',
    type: 'image',
    title: String(p.description || p.alt_description || 'Unsplash photo').slice(0, 90),
    author: (p.user && p.user.name) || 'Unsplash',
    pageUrl: p.links && p.links.html,
    thumb: p.urls && p.urls.small,
    full: p.urls && p.urls.raw + (p.urls.raw.includes('?') ? '&' : '?') + 'w=2560&q=90',
    width: p.width,
    height: p.height,
    category: 'photo',
    tags: (p.tags || []).slice(0, 6).map((t) => t.title),
  }));
  const total = json.total || 0;
  return { items, hasMore: (serverPage + 1) * 30 < total };
}

/* ---------------- Pixabay (photos, or real clips when animated-only) ---------------- */

const PIXABAY_CATEGORY = {
  nature: 'nature',
  landscape: 'nature',
  animals: 'animals',
  travel: 'travel',
  city: 'places',
  architecture: 'buildings',
};

async function fetchPixabay(serverPage, ctx) {
  const { query, filters } = ctx;
  const apiKey = filters.keys && filters.keys.pixabayKey;
  if (!keyed(apiKey)) throw new Error('Pixabay API key missing — add a key or enable the key proxy');
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const nativeCat = PIXABAY_CATEGORY[cat] || '';
  const q = [query, nativeCat ? '' : cat].filter(Boolean).join(' ').trim();

  if (filters.animatedOnly) {
    const params = new URLSearchParams({
      key: apiKey,
      page: String(serverPage + 1),
      per_page: '40',
      safesearch: filters.nsfw ? 'false' : 'true',
    });
    if (nativeCat) params.set('category', nativeCat);
    params.set('q', q || 'wallpaper');
    if (filters.minWidth) params.set('min_width', String(filters.minWidth));
    const json = await getJson(`https://pixabay.com/api/videos/?${params}`);
    const items = (json.hits || []).map((h) => {
      const vids = h.videos || {};
      const best =
        (vids.large && vids.large.url) ||
        (vids.medium && vids.medium.url) ||
        (vids.small && vids.small.url);
      if (!best) return null;
      return {
        id: `pixabay-video:${h.id}`,
        source: 'pixabay',
        type: 'video',
        title: String(h.tags || '').split(', ')[0] || 'Pixabay clip',
        author: h.user || 'Pixabay',
        pageUrl: h.pageURL,
        thumb: (vids.tiny && (vids.tiny.thumbnail || vids.tiny.url)) || (vids.small && vids.small.thumbnail) || null,
        full: best,
        width: (vids.medium && vids.medium.width) || 0,
        height: (vids.medium && vids.medium.height) || 0,
        category: 'video',
        tags: String(h.tags || '').split(', ').slice(0, 6),
        animated: true,
      };
    }).filter(Boolean);
    const total = json.totalHits || 0;
    return { items, hasMore: (serverPage + 1) * 40 < total };
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: q || 'wallpaper',
    page: String(serverPage + 1),
    per_page: '80',
    image_type: 'photo',
    safesearch: filters.nsfw ? 'false' : 'true',
    order: filters.sort === 'latest' ? 'latest' : 'popular',
  });
  if (nativeCat) params.set('category', nativeCat);
  if (filters.minWidth) params.set('min_width', String(filters.minWidth));
  if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
  const json = await getJson(`https://pixabay.com/api/?${params}`);
  const items = (json.hits || []).map((h) => ({
    id: `pixabay:${h.id}`,
    source: 'pixabay',
    type: 'image',
    title: String(h.tags || '').split(', ')[0] || 'Pixabay',
    author: h.user || 'Pixabay',
    pageUrl: h.pageURL,
    thumb: h.webformatURL,
    full: h.largeImageURL || h.webformatURL,
    width: h.imageWidth,
    height: h.imageHeight,
    category: 'photo',
    tags: String(h.tags || '').split(', ').slice(0, 6),
  }));
  const total = json.totalHits || 0;
  return { items, hasMore: (serverPage + 1) * 80 < total };
}

/* ---------------- Tenor GIFs ---------------- */

async function fetchTenor(serverPage, ctx) {
  const { query, filters, meta } = ctx;
  const apiKey = filters.keys && filters.keys.tenorKey;
  if (!keyed(apiKey)) throw new Error('Tenor API key missing — add a key or enable the key proxy');
  const q =
    [query, filters.category !== 'all' ? filters.category : ''].filter(Boolean).join(' ') ||
    'wallpaper';
  const pos = serverPage > 0 && meta.pos ? `&pos=${encodeURIComponent(meta.pos)}` : '';
  const url =
    `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}` +
    `&key=${apiKey}&client_key=wallflow&limit=50&media_filter=gif,tinygif,mediumgif` +
    `&contentfilter=${filters.nsfw ? 'off' : 'high'}${pos}`;
  const json = await getJson(url);
  const items = (json.results || []).map((r) => {
    const mf = r.media_formats || {};
    const gif = mf.gif || mf.mediumgif || {};
    const tiny = mf.tinygif || mf.gif || {};
    return {
      id: `tenor:${r.id}`,
      source: 'tenor',
      type: 'image',
      title: String(r.title || 'Animated GIF').slice(0, 80),
      author: 'Tenor',
      pageUrl: r.itemurl,
      thumb: tiny.url,
      full: (mf.mediumgif && mf.mediumgif.url) || gif.url,
      width: gif.width || 0,
      height: gif.height || 0,
      category: 'gif',
      tags: [],
    };
  });
  if (json.next) meta.pos = String(json.next);
  return { items, hasMore: !!json.next && items.length > 0 };
}

/* ---------------- Motion (videos) ---------------- */

const MIXKIT_DEFAULT_TERMS = ['nature', 'abstract', 'city', 'ocean', 'space', 'fire', 'animals', 'travel'];

const MIXKIT_TERM_BY_CONTENT = {
  nature: 'nature',
  landscape: 'nature',
  animals: 'animals',
  universe: 'space',
  space: 'space',
  ocean: 'ocean',
  city: 'city',
  architecture: 'city',
  fire: 'fire',
  abstract: 'abstract',
  travel: 'travel',
  night: 'night',
  fantasy: 'fantasy',
};

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchMixkit(term, page) {
  const html = await getText(
    `https://mixkit.co/free-stock-video/${encodeURIComponent(term)}/${page > 1 ? `?page=${page}` : ''}`
  );
  // direct mp4s come in two shapes: /videos/{id}/{id}-{res}.mp4 and
  // /active_storage/video_items/{id}/{stamp}/{id}-video-{res}.mp4 — take the best res per id
  const best = new Map();
  for (const m of html.matchAll(/https:\/\/assets\.mixkit\.co\/[^"'\\ ]*?\/(\d+)[^"'\\ ]*-(\d+)\.mp4/g)) {
    const id = m[1];
    const res = Number(m[2]);
    const cur = best.get(id);
    if (!cur || res > cur.res) best.set(id, { url: m[0], res });
  }
  const titles = new Map();
  for (const m of html.matchAll(/\/free-stock-video\/([a-z0-9-]+)-(\d+)\//g)) {
    if (!titles.has(m[2])) titles.set(m[2], m[1].replace(/-/g, ' '));
  }
  const thumbs = new Map();
  for (const m of html.matchAll(/https:\/\/assets\.mixkit\.co\/[^"'\\ ]*?\/(\d+)[^"'\\ ]*thumb[^"'\\ ]*?-(\d+)[^"'\\ ]*\.jpg/g)) {
    const id = m[1];
    const res = Number(m[2]);
    const cur = thumbs.get(id);
    if (!cur || res > cur.res) thumbs.set(id, { url: m[0], res });
  }
  const items = [];
  for (const [id, v] of best) {
    const slug = titles.get(id);
    // the listing page only advertises 360p for many clips, but the same path
    // serves a 720p file — upgrade so wallpapers aren't upscaled 360p video
    let full = v.url;
    let fallback = null;
    if (v.res < 720) {
      const up = v.url.replace(/-\d+\.mp4$/, '-720.mp4');
      if (up !== v.url) {
        full = up;
        fallback = v.url;
      }
    }
    items.push({
      id: `motion:mixkit-${id}`,
      source: 'motion',
      type: 'video',
      title: slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Mixkit clip',
      author: 'Mixkit',
      pageUrl: slug ? `https://mixkit.co/free-stock-video/${slug}-${id}/` : 'https://mixkit.co/',
      thumb: (thumbs.get(id) || {}).url || null,
      full,
      fallback,
      width: 0,
      height: 0,
      category: 'video',
      tags: [],
      animated: true,
    });
  }
  return items;
}

async function fetchMotion(serverPage, ctx) {
  const { query, filters, keys } = ctx;
  const cat = filters.category && filters.category !== 'all' ? filters.category : '';
  const q = [query, cat].filter(Boolean).join(' ').trim();
  const out = [];
  let hasMore = false;

  // Mixkit — keyless curated stock loops, searched via tag/category pages
  try {
    let term;
    let page;
    if (query) {
      term = slugify(query);
      page = serverPage + 1;
    } else if (cat) {
      term = MIXKIT_TERM_BY_CONTENT[cat] || null;
      page = serverPage + 1;
    } else {
      term = MIXKIT_DEFAULT_TERMS[serverPage % MIXKIT_DEFAULT_TERMS.length];
      page = 1;
    }
    if (term) {
      const mixkitItems = await fetchMixkit(term, page);
      if (mixkitItems.length) {
        out.push(...mixkitItems);
        hasMore = true;
      }
    }
  } catch {
    /* mixkit optional */
  }

  // stock video providers when keys are configured — paginated with serverPage
  try {
    if (keys && keyed(keys.pexelsKey)) {
      const params = new URLSearchParams({ query: q || 'nature', page: String(serverPage + 1), per_page: '40' });
      if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
      const json = await getJson(`https://api.pexels.com/videos/search?${params}`, {
        headers: { Authorization: keys.pexelsKey },
      });
      const vids = json.videos || [];
      for (const v of vids) {
        const files = (v.video_files || [])
          .filter((f) => f.link && /mp4/i.test(f.link || ''))
          .sort((a, b) => Math.abs((a.height || 0) - 1080) - Math.abs((b.height || 0) - 1080));
        const best = files[0];
        if (!best) continue;
        const slug = String(v.url || '').split('/').filter(Boolean).pop() || '';
        const slugTitle = slug.replace(/-\d+$/, '').replace(/-/g, ' ').trim();
        out.push({
          id: `pexels-video:${v.id}`,
          source: 'motion',
          type: 'video',
          title: slugTitle ? slugTitle.charAt(0).toUpperCase() + slugTitle.slice(1) : 'Pexels clip',
          author: 'Pexels',
          pageUrl: v.url,
          thumb: (v.video_pictures && v.video_pictures[0] && v.video_pictures[0].picture) || null,
          full: best.link,
          width: v.width || 0,
          height: v.height || 0,
          category: 'video',
          tags: [],
          animated: true,
        });
      }
      if (vids.length) hasMore = true;
    }
    if (keys && keyed(keys.pixabayKey)) {
      const params = new URLSearchParams({
        key: keys.pixabayKey,
        q: q || 'nature',
        page: String(serverPage + 1),
        per_page: '40',
        safesearch: filters.nsfw ? 'false' : 'true',
      });
      const json = await getJson(`https://pixabay.com/api/videos/?${params}`);
      const hits = json.hits || [];
      for (const h of hits) {
        const vids = h.videos || {};
        const best = (vids.large && vids.large.url) || (vids.medium && vids.medium.url);
        if (!best) continue;
        out.push({
          id: `pixabay-video:${h.id}`,
          source: 'motion',
          type: 'video',
          title: String(h.tags || '').split(', ')[0] || 'Pixabay clip',
          author: h.user || 'Pixabay',
          pageUrl: h.pageURL,
          thumb: null,
          full: best,
          width: (vids.medium && vids.medium.width) || 0,
          height: (vids.medium && vids.medium.height) || 0,
          category: 'video',
          tags: [],
          animated: true,
        });
      }
      if (hits.length) hasMore = true;
    }
  } catch {
    /* stock providers optional */
  }

  // curated demo clips last — they pad the feed after real content, never lead it
  if (serverPage === 0 && out.length < 8) {
    for (const v of CURATED_VIDEOS) {
      out.push({
        id: `motion:${v.id}`,
        source: 'motion',
        type: 'video',
        title: v.title,
        author: 'Sample media',
        pageUrl: v.pageUrl,
        thumb: null,
        full: v.full,
        width: v.width,
        height: v.height,
        category: 'video',
        tags: [],
        animated: true,
      });
    }
  }

  return { items: out, hasMore };
}

/* ---------------- Workshop (community uploads) ---------------- */

/* Served by the workshop API; approved uploads come back newest-first. */
async function fetchWorkshop(serverPage, ctx) {
  const base = workshopBase();
  if (!base) return { items: [], hasMore: false };
  const params = new URLSearchParams({
    page: String(serverPage),
    pageSize: '40',
  });
  if (ctx.query) params.set('q', ctx.query);
  if (ctx.filters.nsfw) params.set('nsfw', '1');
  if (ctx.filters.category && ctx.filters.category !== 'all') params.set('tag', ctx.filters.category);
  const data = await getJson(`${base}/api/workshop/list?${params}`, { timeout: 15000 });
  return {
    items: data && Array.isArray(data.items) ? data.items : [],
    hasMore: !!(data && data.hasMore),
  };
}

/* ---------------- router ---------------- */

const FETCHERS = {
  wallhaven: fetchWallhaven,
  nasa: fetchNasa,
  wikimedia: fetchWikimedia,
  artic: fetchArtic,
  cleveland: fetchCleveland,
  met: fetchMet,
  anime: fetchAnime,
  konachan: fetchKonachan,
  pexels: fetchPexels,
  unsplash: fetchUnsplash,
  pixabay: fetchPixabay,
  tenor: fetchTenor,
  motion: fetchMotion,
  workshop: fetchWorkshop,
};

function buildCtx(opts) {
  return {
    query: (opts.query || '').trim(),
    filters: {
      orientation: opts.orientation || 'all',
      category: opts.category || 'all',
      minWidth: opts.minWidth || 0,
      sort: opts.sort || 'relevance',
      nsfw: !!opts.nsfw,
      animatedOnly: !!opts.animatedOnly,
      keys: opts.keys || {},
    },
    keys: opts.keys || {},
    meta: {},
  };
}

function cacheKeyFor(source, ctx) {
  const f = ctx.filters;
  return [
    source,
    ctx.query,
    f.orientation,
    f.category,
    f.minWidth,
    f.sort,
    f.nsfw ? 'x' : 's',
    f.animatedOnly ? 'anim' : 'still',
    f.keys && f.keys[Object.keys(f.keys).find((k) => k)] ? 'k' : '',
  ].join('|');
}

/* Sources the user switched off in Settings — read live so toggles apply instantly */
function getDisabledSources() {
  try {
    const { getSettings } = require('./store');
    return new Set(getSettings().disabledSources || []);
  } catch {
    return new Set();
  }
}

async function search(source, opts = {}) {
  const fetcher = FETCHERS[source];
  if (!fetcher) throw new Error(`Unknown source: ${source}`);
  if (getDisabledSources().has(source)) return { items: [], hasMore: false };
  const ctx = buildCtx(opts);
  // animated-only mode: static-only sources are skipped without a network call
  if (ctx.filters.animatedOnly && !ANIMATED_SOURCES.has(source)) {
    return { items: [], hasMore: false };
  }
  const page = Math.max(0, opts.page || 0);
  const size = opts.pageSize || 40;
  // per-source cache key includes which key-bearing provider settings matter
  const key =
    source === 'wallhaven'
      ? `wh|${cacheKeyFor(source, ctx)}|${(ctx.filters.keys.wallhavenKey || '').slice(0, 6)}`
      : ['pexels', 'unsplash', 'pixabay', 'tenor', 'motion'].includes(source)
        ? `${source}|${cacheKeyFor(source, ctx)}|${Object.values(ctx.filters.keys)
            .map((v) => String(v || '').slice(0, 6))
            .join(',')}`
        : cacheKeyFor(source, ctx);
  return paginate(key, async (serverPage, meta) => {
    const res = await fetcher(serverPage, { ...ctx, meta });
    if (res && Array.isArray(res.items)) {
      if (ctx.filters.animatedOnly) res.items = res.items.filter(isAnimatedItem);
      // wallpaper-quality gate: no people or clutter while SFW; NSFW is
      // unrestricted. Workshop uploads skip it — an admin approved each one.
      if (!ctx.filters.nsfw && source !== 'workshop') res.items = res.items.filter(isWallpaperLike);
      res.items = applyCommonFilters(res.items, ctx.filters);
    }
    return res;
  }, page, size);
}

/* ---------------- aggregate: every source ---------------- */

async function searchAll(opts = {}) {
  const pageSize = Math.min(opts.pageSize || 24, 30);
  const disabled = getDisabledSources();
  const ids = SOURCES.map((s) => s.id).filter((id) => !disabled.has(id));
  if (!ids.length) return { items: [], hasMore: false };

  const runBatch = (sourceIds) =>
    Promise.allSettled(sourceIds.map((id) => search(id, { ...opts, pageSize })));

  let settled = await runBatch(ids);
  // one retry wave for transient failures (rate limits, timeouts)
  const failed = ids.filter((_, i) => settled[i].status === 'rejected');
  if (failed.length) {
    await new Promise((r) => setTimeout(r, 600));
    const retry = await runBatch(failed);
    failed.forEach((id, i) => {
      const idx = ids.indexOf(id);
      settled[idx] = retry[i];
    });
  }

  const buckets = [];
  let hasMore = false;
  let errors = 0;
  let firstError = null;
  settled.forEach((r) => {
    if (r.status === 'fulfilled') {
      buckets.push(r.value.items);
      if (r.value.hasMore) hasMore = true;
    } else {
      errors++;
      if (!firstError) firstError = r.reason;
    }
  });
  if (errors === ids.length && firstError) throw firstError;
  const merged = [];
  const maxLen = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) if (bucket[i]) merged.push(bucket[i]);
  }
  const seen = new Set();
  const items = merged.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
  return { items, hasMore };
}

/* ---------------- recommendations ---------------- */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'untitled', 'landscape', 'photo',
  'photograph', 'wallpaper', 'image', 'general', 'scenery', 'art', 'style',
]);

function pickQueries(favorites) {
  const freq = new Map();
  const bump = (term, w = 1) => {
    const t = String(term || '').trim().toLowerCase().replace(/_/g, ' ');
    if (t.length < 3 || t.length > 24 || STOP_WORDS.has(t) || /\d{3,}/.test(t)) return;
    freq.set(t, (freq.get(t) || 0) + w);
  };
  for (const f of favorites) {
    for (const t of (f.tags || []).slice(0, 8)) bump(t, 2);
    bump(f.category, 2);
    for (const w of String(f.title || '').split(/\s+/)) bump(w, 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 5);
  const fallback = ['nature', 'space', 'mountains', 'ocean', 'night city'];
  while (top.length < 3) {
    const f = fallback[top.length % fallback.length];
    if (!top.includes(f)) top.push(f);
    else top.push(f + ' wallpaper');
  }
  return top;
}

const STATIC_FILLERS = ['wallhaven', 'wikimedia', 'nasa', 'artic'];
const ANIMATED_FILLERS = ['motion', 'tenor', 'nasa', 'wikimedia'];

function pickSources(favorites, animatedOnly) {
  const counts = new Map();
  for (const f of favorites) counts.set(f.source, (counts.get(f.source) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const eligible = (s) => FETCHERS[s] && (!animatedOnly || ANIMATED_SOURCES.has(s));
  const core = ranked.slice(0, 3).filter(eligible);
  const fillers = (animatedOnly ? ANIMATED_FILLERS : STATIC_FILLERS).filter(
    (s) => !core.includes(s)
  );
  return [...core, ...fillers].slice(0, 5);
}

async function recommend(opts = {}) {
  const { getFavorites, getLibrary } = require('./store');
  const favorites = getFavorites();
  const library = getLibrary();
  const owned = new Set([...favorites, ...library].map((i) => i.id));
  const queries = pickQueries(favorites);
  const animatedOnly = !!opts.animatedOnly;
  const disabled = getDisabledSources();
  const sources = (
    favorites.length
      ? pickSources(favorites, animatedOnly)
      : animatedOnly
        ? ANIMATED_FILLERS
        : STATIC_FILLERS
  ).filter((s) => !disabled.has(s) && FETCHERS[s]);

  const combos = [];
  for (const source of sources) {
    for (const query of queries.slice(0, favorites.length ? 3 : 2)) {
      combos.push({ source, query });
    }
  }
  const chosen = favorites.length
    ? combos.sort(() => Math.random() - 0.5).slice(0, 8)
    : combos.slice(0, 8);

  const settled = await Promise.allSettled(
    chosen.map(({ source, query }) =>
      search(source, { ...opts, query, page: 0, pageSize: 18, category: opts.category || 'all' })
    )
  );

  const buckets = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value.items.filter((i) => !owned.has(i.id)));

  if (!buckets.length) {
    try {
      const fallback = await searchAll({ ...opts, query: '', page: 0, pageSize: 24 });
      return {
        items: fallback.items.filter((i) => !owned.has(i.id)).slice(0, 60),
        hasMore: false,
        reason: favorites.length ? 'Fresh picks while your matches load' : 'Popular wallpapers to get you started',
      };
    } catch (e) {
      return { items: [], hasMore: false, reason: '', error: String(e.message || e) };
    }
  }

  const merged = [];
  const seen = new Set();
  const maxLen = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) if (bucket[i]) merged.push(bucket[i]);
  }
  const items = merged
    .filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    })
    .slice(0, 60);

  let reason;
  if (!favorites.length) reason = 'Popular wallpapers to get you started';
  else reason = `Because you liked “${favorites[0].title || favorites[0].source}”`;
  return { items, hasMore: false, reason };
}

function listSources(keys = {}, opts = {}) {
  const disabled = opts.disabled || new Set();
  return SOURCES.filter((s) => {
    if (disabled.has(s.id)) return false;
    if (s.requiresKey && !keyed(keys[s.requiresKey])) return false;
    if (opts.animatedOnly && !s.animated) return false;
    return true;
  });
}

module.exports = {
  search,
  searchAll,
  recommend,
  listSources,
  proxyActive,
  SOURCES,
  CONTENTS,
  isAnimatedItem,
  isWallpaperLike,
};
