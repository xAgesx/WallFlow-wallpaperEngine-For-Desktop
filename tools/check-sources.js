/* Smoke test for WallFlow sources: node tools/check-sources.js */
const {
  search,
  searchAll,
  listSources,
  CONTENTS,
  isAnimatedItem,
  isWallpaperLike,
} = require('../src/main/apis');

const keys = {}; // keyless on purpose — exercises the default install

function log(...a) {
  console.log(...a);
}

async function check(label, source, opts, expectAnimated) {
  const t = Date.now();
  try {
    const r = await search(source, { page: 0, pageSize: 12, ...opts });
    const bad = r.items.filter((i) => expectAnimated && !isAnimatedItem(i));
    // wallpaper gate: SFW results must never contain people/clutter titles
    const wallBad = opts.nsfw ? 0 : r.items.filter((i) => !isWallpaperLike(i)).length;
    const ms = Date.now() - t;
    const sample = r.items[0]
      ? `${r.items[0].type} · ${String(r.items[0].title).slice(0, 42)} · ${String(r.items[0].full || '').slice(0, 70)}`
      : '(no items)';
    const failed = bad.length || wallBad;
    log(
      `${failed ? 'FAIL' : ' ok '} ${label.padEnd(34)} ${String(r.items.length).padStart(3)} items  hasMore=${String(r.hasMore).padEnd(5)} ${ms}ms  ${sample}`
    );
    if (bad.length) log(`      !! ${bad.length} non-animated items leaked`);
    if (wallBad) {
      const leak = r.items.find((i) => !isWallpaperLike(i));
      log(`      !! ${wallBad} people/clutter items leaked: "${String(leak.title).slice(0, 60)}"`);
    }
    return r;
  } catch (e) {
    log(`ERR ${label.padEnd(34)} ${e.message}`);
    return { items: [], hasMore: false };
  }
}

(async () => {
  log('— source lists —');
  log('all:       ', listSources(keys, {}).map((s) => s.id).join(', '));
  log('animated:  ', listSources(keys, { animatedOnly: true }).map((s) => s.id).join(', '));
  log('disabled:  ', listSources(keys, { disabled: new Set(['wallhaven', 'gif']) }).map((s) => s.id).join(', '));
  log('contents:  ', CONTENTS.map((c) => c.id).join(', '));

  log('\n— animated-only, keyless —');
  await check('motion / universe', 'motion', { animatedOnly: true, category: 'space' }, true);
  await check('motion / no filter', 'motion', { animatedOnly: true }, true);
  await check('motion / query ocean', 'motion', { animatedOnly: true, query: 'ocean' }, true);
  await check('gif / ocean', 'gif', { animatedOnly: true, category: 'ocean' }, true);
  await check('gif / no filter', 'gif', { animatedOnly: true }, true);
  await check('gif / anime', 'gif', { animatedOnly: true, category: 'anime' }, true);
  await check('anime / night', 'anime', { animatedOnly: true, category: 'night' }, true);
  await check('konachan / landscape', 'konachan', { animatedOnly: true, category: 'landscape' }, true);
  await check('konachan / anime + query', 'konachan', { animatedOnly: true, query: 'sky' }, true);
  await check('nasa / universe', 'nasa', { animatedOnly: true, category: 'space' }, true);
  await check('wikimedia / nature', 'wikimedia', { animatedOnly: true, category: 'nature' }, true);

  log('\n— static sources must be skipped instantly —');
  await check('wallhaven (skip)', 'wallhaven', { animatedOnly: true }, true);
  await check('artic (skip)', 'artic', { animatedOnly: true }, true);

  log('\n— content filter on still-image mode —');
  await check('wallhaven query+content', 'wallhaven', { query: 'mountain', category: 'night' }, false);
  await check('wikimedia content', 'wikimedia', { category: 'ocean' }, false);
  await check('wikimedia query', 'wikimedia', { query: 'forest' }, false);
  await check('artic museum', 'artic', {}, false);
  await check('cleveland museum', 'cleveland', {}, false);
  await check('met museum', 'met', {}, false);

  log('\n— wallpaper gate: people/clutter must not leak (SFW) —');
  await check('wikimedia people query', 'wikimedia', { query: 'portrait woman' }, false);
  await check('nasa astronaut query', 'nasa', { query: 'astronaut' }, false);
  await check('gif map clutter', 'gif', { query: 'map' }, false);

  log('\n— NSFW unrestricted (keyless paths) —');
  const knsfw = await check('konachan nsfw', 'konachan', { nsfw: true, animatedOnly: true }, true);
  if (!knsfw.items.length) log('      !! nsfw konachan returned nothing — explicit mirror broken');
  const answ = await check('anime nsfw', 'anime', { nsfw: true, animatedOnly: true }, true);
  if (!answ.items.length) log('      !! nsfw anime returned nothing');
  // the gate must be OFF in nsfw mode: people titles are allowed through
  const whNsfw = await check('wallhaven nsfw (needs key)', 'wallhaven', { nsfw: true }, false);
  if (!whNsfw.items.length) log('      (expected keyless: wallhaven NSFW needs an API key)');

  log('\n— per-source switches —');
  const storePath = require.resolve('../src/main/store');
  const Module = require('module');
  const stub = new Module(storePath);
  stub.exports = { getSettings: () => ({ disabledSources: ['gif'] }) };
  stub.loaded = true;
  const hadStore = !!require.cache[storePath];
  const prevStore = require.cache[storePath];
  require.cache[storePath] = stub;
  try {
    const dis = await search('gif', { animatedOnly: true, page: 0, pageSize: 5 });
    log(dis.items.length === 0 ? ' ok  search() skips a disabled source' : `FAIL disabled gif returned ${dis.items.length} items`);
    const all = await searchAll({ animatedOnly: true, page: 0, pageSize: 12 });
    const gifLeak = all.items.filter((i) => i.source === 'gif').length;
    log(gifLeak === 0 ? ' ok  searchAll() excludes disabled sources' : `FAIL searchAll kept ${gifLeak} gif items`);
  } catch (e) {
    log('FAIL disabled-source check:', e.message);
  } finally {
    if (hadStore) require.cache[storePath] = prevStore;
    else delete require.cache[storePath];
  }

  log('\n— aggregate —');
  const t = Date.now();
  try {
    const all = await searchAll({ animatedOnly: true, page: 0, pageSize: 24 });
    const bySource = {};
    for (const i of all.items) bySource[i.source] = (bySource[i.source] || 0) + 1;
    const bad = all.items.filter((i) => !isAnimatedItem(i)).length;
    const wallBad = all.items.filter((i) => !isWallpaperLike(i)).length;
    log(`searchAll(animated): ${all.items.length} items, hasMore=${all.hasMore}, ${Date.now() - t}ms, leaks=${bad}, wallLeaks=${wallBad}`);
    log('  by source:', JSON.stringify(bySource));
    if (wallBad) {
      const leak = all.items.find((i) => !isWallpaperLike(i));
      log('  !! gate leak:', String(leak.source), '-', String(leak.title).slice(0, 70));
    }
  } catch (e) {
    log('searchAll FAILED:', e.message);
  }

  log('\n— page 2 stability —');
  await check('motion page 2', 'motion', { animatedOnly: true, category: 'space', page: 1 }, true);
  await check('gif page 2', 'gif', { animatedOnly: true, category: 'night', page: 1 }, true);
  log('\ndone');
})();
