/* WallFlow library UI */
(() => {
  const api = window.wallflow;

  const state = {
    view: 'foryou',
    source: 'all',
    sources: [],
    allSources: [],
    query: '',
    orientation: 'all',
    category: 'all',
    minWidth: '0',
    sort: 'relevance',
    nsfw: false,
    contents: [],
    items: [],
    page: 0,
    hasMore: false,
    loading: false,
    favorites: [],
    library: [],
    settings: null,
    status: null,
    reason: '',
    seen: new Set(),
  };

  // bumped every time the feed grid is reset, so a response that was already
  // in flight (e.g. from before a source was toggled off) can never
  // repopulate a grid that a newer load has taken ownership of
  let feedGen = 0;
  let feedInFlight = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    grid: $('#grid'),
    scroll: $('#grid-scroll'),
    sentinel: $('#sentinel'),
    loader: $('#loader'),
    stateMsg: $('#state-msg'),
    search: $('#search'),
    searchClear: $('#search-clear'),
    fSource: $('#f-source'),
    fOrientation: $('#f-orientation'),
    fCategory: $('#f-category'),
    fMinWidth: $('#f-minwidth'),
    fSort: $('#f-sort'),
    fNsfw: $('#f-nsfw'),
    fAnimated: $('#f-animated'),
    fAnimatedWrap: $('#f-animated-wrap'),
    settingsView: $('#settings-view'),
    topbar: $('#topbar'),
    banner: $('#view-banner'),
    previewBar: $('#preview-bar'),
    pbText: $('#pb-text'),
    nowPlaying: $('#now-playing'),
    toasts: $('#toasts'),
    modal: $('#modal'),
    modalInput: $('#modal-input'),
    confirm: $('#confirm'),
    confirmTitle: $('#confirm-title'),
    confirmMsg: $('#confirm-msg'),
    confirmOk: $('#confirm-ok'),
    confirmCancel: $('#confirm-cancel'),
    welcome: $('#welcome'),
  };

  const ICONS = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 4v10M12 14l-4-4M12 14l4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17v2h14v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M6 7h12M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M8 7l.7 11a2 2 0 0 0 2 1.9h2.6a2 2 0 0 0 2-1.9L16 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    set: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 20h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };

  /* ---------------- helpers ---------------- */

  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    els.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /* Reusable confirmation dialog — resolves true (confirm) or false (cancel). */
  function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmMsg.textContent = message;
      els.confirmOk.textContent = confirmLabel;
      els.confirmOk.classList.toggle('danger-btn', danger);
      els.confirmOk.classList.toggle('primary-btn', !danger);
      els.confirm.hidden = false;
      const done = (val) => {
        els.confirm.hidden = true;
        els.confirmOk.removeEventListener('click', onOk);
        els.confirmCancel.removeEventListener('click', onCancel);
        els.confirm.removeEventListener('click', onBg);
        document.removeEventListener('keydown', onKey, true);
        resolve(val);
      };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onBg = (e) => { if (e.target === els.confirm) done(false); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      els.confirmOk.addEventListener('click', onOk);
      els.confirmCancel.addEventListener('click', onCancel);
      els.confirm.addEventListener('click', onBg);
      document.addEventListener('keydown', onKey, true);
      setTimeout(() => els.confirmOk.focus(), 50);
    });
  }

  function isLocal(item) {
    if (!item) return false;
    if (item.localPath || item.uploaded) return true;
    // feed/favorites copies may not carry localPath — check the library too,
    // so already-downloaded wallpapers are treated as local everywhere
    const lib = state.library.find((l) => l.id === item.id);
    return !!(lib && (lib.localPath || lib.uploaded));
  }

  function isFav(id) {
    return state.favorites.some((f) => f.id === id);
  }

  function fmtRes(item) {
    if (item.width && item.height) return `${item.width}×${item.height}`;
    return '';
  }

  function animLabel(item) {
    const animated =
      item.type === 'video' ||
      item.animated ||
      /\.gif(\?|#|$)/i.test(String(item.full || item.thumb || ''));
    if (!animated) return '';
    const m = String(item.full || '').match(/\.([a-z0-9]{2,4})(?:\?|#|$)/i);
    const ext = (m ? m[1] : item.type === 'video' ? 'mp4' : 'gif').toLowerCase();
    return ext === 'mkv' || ext === 'mov' ? 'video' : ext;
  }

  function applyChrome() {
    const s = state.settings;
    document.body.dataset.theme = s.theme || 'dark';
    document.body.dataset.density = s.density || 'comfortable';
    document.documentElement.style.setProperty('--accent', s.accent || '#8b9cff');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function cssEsc(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function currentSourceDef() {
    return state.sources.find((s) => s.id === state.source);
  }

  function isFeedView() {
    return state.view === 'foryou' || state.view === 'all';
  }

  function searchSourceParam() {
    if (state.view === 'all') return state.source === 'all' ? 'all' : state.source;
    if (state.view === 'foryou') {
      if (state.query) return 'all';
      return state.source === 'all' ? 'recommend' : state.source;
    }
    return state.source;
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    const [settings, sources, allSources, favorites, library, status, contents] = await Promise.all([
      api.invoke('settings:get'),
      api.invoke('app:sources'),
      api.invoke('app:allSources'),
      api.invoke('favorites:list'),
      api.invoke('library:list'),
      api.invoke('wallpaper:status'),
      api.invoke('app:contents'),
    ]);
    state.settings = settings;
    state.sources = sources;
    state.allSources = allSources || [];
    state.favorites = favorites;
    state.library = library;
    state.status = status;
    state.contents = contents || [];
    state.nsfw = !!settings.nsfwMode;
    applyChrome();
    renderSourceSelect();
    bindSettings();
    renderSourceToggles();
    updateCounts();
    renderStatus();
    setupObserver();
    populateFilters();
    await loadFeed(true);
    maybeShowWelcome();
  }

  /* ---------------- first-run welcome ---------------- */

  function maybeShowWelcome() {
    if (state.settings && state.settings.hasSeenWelcome) return;
    els.welcome.hidden = false;
  }

  async function dismissWelcome(goSettings) {
    els.welcome.hidden = true;
    try {
      state.settings = await api.invoke('settings:set', { hasSeenWelcome: true });
    } catch {
      /* non-fatal: worst case it shows again next launch */
    }
    if (goSettings) setView('settings');
  }

  $('#welcome-start').addEventListener('click', () => dismissWelcome(false));
  $('#welcome-settings').addEventListener('click', () => dismissWelcome(true));

  function updateCounts() {
    $('#count-fav').textContent = state.favorites.length || '';
    $('#count-lib').textContent = state.library.length || '';
    const allBadge = $('#count-all');
    if (allBadge) allBadge.textContent = state.view === 'all' && state.items.length ? state.items.length : '';
  }

  function renderSourceSelect() {
    const opts = ['<option value="all">All sources</option>']
      .concat(state.sources.map((s) => `<option value="${s.id}">${s.name}</option>`))
      .join('');
    els.fSource.innerHTML = opts;
    els.fSource.value = state.source;
  }

  function renderSourceToggles() {
    const wrap = $('#source-switches');
    if (!wrap || !state.allSources.length || !state.settings) return;
    const disabled = new Set(state.settings.disabledSources || []);
    wrap.innerHTML = state.allSources
      .map((s) => {
        // key presence comes from the main process (env keys), never the key itself
        const needsKey = s.requiresKey && !s.hasKey;
        const hint = s.description + (needsKey ? ' — unavailable: no API key configured' : '');
        return (
          `<div class="set-row">` +
          `<label>${escapeHtml(s.name)}<br /><span class="hint-inline">${escapeHtml(hint)}</span></label>` +
          `<label class="switch"><input type="checkbox" data-source-toggle="${escapeHtml(s.id)}"` +
          `${disabled.has(s.id) ? '' : ' checked'} /><span></span></label>` +
          `</div>`
        );
      })
      .join('');
    $$('#source-switches [data-source-toggle]').forEach((input) => {
      input.addEventListener('change', () => onSourceToggle(input));
    });
  }

  // settings writes are serialized: each toggle reads the persisted settings
  // right before writing, so a stale renderer copy can never wipe out another
  // source's disabled state
  let settingsWriteQueue = Promise.resolve();

  function onSourceToggle(input) {
    const id = input.dataset.sourceToggle;
    const write = settingsWriteQueue.then(async () => {
      const fresh = await api.invoke('settings:get');
      const disabled = new Set(fresh.disabledSources || []);
      if (input.checked) disabled.delete(id);
      else disabled.add(id);
      if (state.allSources.length - disabled.size <= 0) {
        input.checked = true;
        toast('Keep at least one source enabled', 'error');
        return;
      }
      state.settings = await api.invoke('settings:set', { disabledSources: [...disabled] });
      state.sources = await api.invoke('app:sources');
      if (state.source !== 'all' && !state.sources.some((s) => s.id === state.source)) {
        state.source = 'all';
      }
      renderSourceSelect();
      populateFilters();
      const name = ((state.allSources.find((s) => s.id === id) || {}).name) || id;
      toast(input.checked ? `${name} enabled` : `${name} disabled`, input.checked ? 'ok' : '');
      if (isFeedView()) loadFeed(true);
    });
    settingsWriteQueue = write.catch(() => {});
    write.catch((e) => {
      input.checked = !input.checked;
      toast('Could not update sources: ' + String(e.message || e), 'error');
    });
  }

  /* ---------------- filters ---------------- */

  function populateFilters() {
    const feed = isFeedView();
    const foryou = state.view === 'foryou';
    const src = currentSourceDef();

    els.search.disabled = false;
    els.search.placeholder = !feed
      ? state.view === 'favorites'
        ? 'Search favorites…'
        : 'Search my wallpapers…'
      : foryou && state.source === 'all' && !state.query
        ? 'Search every wallpaper…'
        : state.source === 'all'
          ? 'Search every source…'
          : `Search ${src ? src.name : ''}…`;

    els.fSource.style.display = feed ? '' : 'none';
    els.fOrientation.style.display = feed ? '' : 'none';
    els.fMinWidth.style.display = feed ? '' : 'none';
    els.fNsfw.style.display =
      feed && state.settings && state.settings.nsfwMode ? 'inline-flex' : 'none';
    els.fSort.style.display = feed && !foryou ? '' : 'none';
    els.fNsfw.checked = !!(state.settings && state.settings.nsfwMode && state.nsfw);

    // animated-only chip — always available while browsing feeds
    els.fAnimatedWrap.style.display = feed ? 'inline-flex' : 'none';
    els.fAnimated.checked = !!(state.settings && state.settings.animatedOnly);

    // content filter — one global list, applies to every source
    els.fCategory.style.display = feed ? '' : 'none';
    if (feed && els.fCategory.dataset.for !== 'contents') {
      const opts = ['<option value="all">Any content</option>']
        .concat(
          state.contents.map(
            (c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`
          )
        )
        .join('');
      els.fCategory.innerHTML = opts;
      els.fCategory.dataset.for = 'contents';
    }
    els.fCategory.value = state.category;

    // sort options: per-source sorts, or a common set when browsing All
    const sorts =
      state.source === 'all'
        ? ['relevance', 'hot', 'date_added', 'top', 'random']
        : src
          ? src.sorts || ['relevance']
          : ['relevance'];
    const sortKey = state.source;
    if (els.fSort.dataset.for !== sortKey) {
      els.fSort.innerHTML = sorts
        .map((s) => `<option value="${s}">${s.replace(/_/g, ' ')}</option>`)
        .join('');
      els.fSort.dataset.for = sortKey;
      state.sort = sorts[0];
    }
    els.fSort.value = state.sort;
    els.fOrientation.value = state.orientation;
    els.fMinWidth.value = state.minWidth;
    els.fNsfw.checked = state.nsfw;
  }

  /* ---------------- views ---------------- */

  function setView(view) {
    state.view = view;
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
    const isSettings = view === 'settings';
    els.settingsView.hidden = !isSettings;
    els.scroll.hidden = isSettings;
    els.topbar.style.display = isSettings ? 'none' : '';
    els.banner.hidden = true;

    populateFilters();
    updateCounts();

    if (isSettings) {
      // re-read persisted settings so switches reflect any change made
      // outside this window (or a stale boot copy)
      renderSourceToggles();
      api.invoke('settings:get').then((s) => {
        if (!s || state.view !== 'settings') return;
        state.settings = s;
        renderSourceToggles();
      });
      return;
    }
    if (view === 'foryou' || view === 'all') loadFeed(true);
    else if (view === 'favorites')
      renderCollection(state.favorites, 'No favorites yet', 'Tap the heart on any wallpaper to keep it here.', { label: 'Browse wallpapers', act: 'browse' });
    else if (view === 'local')
      renderCollection(state.library, 'No wallpapers downloaded', 'Upload files or hit Download on any wallpaper — they stay on your machine.', { label: 'Upload files', act: 'upload' });
  }

  async function loadFeed(reset = true) {
    if (!isFeedView()) return;
    if (reset) {
      feedGen++;
      state.page = 0;
      state.items = [];
      state.seen = new Set();
      state.reason = '';
      els.grid.innerHTML = '';
      setStateMsg('loading');
      els.banner.hidden = true;
      // wait out any fetch still in flight — it drops its own stale result now,
      // and starting the new load before it settles would just bail on
      // state.loading and leave the grid empty until the stale response lands
      if (feedInFlight) await feedInFlight.catch(() => {});
    }
    await fetchPage();
  }

  async function fetchPage() {
    if (state.loading || !isFeedView()) return;
    const gen = feedGen;
    state.loading = true;
    els.loader.hidden = false;
    const task = (async () => {
      try {
        const res = await api.invoke('app:search', {
          source: searchSourceParam(),
          query: state.query,
          orientation: state.orientation,
          category: state.category,
          minWidth: Number(state.minWidth) || 0,
          sort: state.sort,
          nsfw: !!(state.settings && state.settings.nsfwMode && state.nsfw),
          animatedOnly: !!(state.settings && state.settings.animatedOnly),
          page: state.page,
          pageSize: state.view === 'all' && state.source === 'all' ? 24 : 40,
        });
        if (gen !== feedGen) return; // a newer load owns the grid now
        if (res.error) throw new Error(res.error);
        if (res.reason) state.reason = res.reason;
        const fresh = res.items.filter((i) => !state.seen.has(i.id));
        fresh.forEach((i) => state.seen.add(i.id));
        state.items.push(...fresh);
        state.hasMore = !!res.hasMore;
        state.page += 1;

        if (state.view === 'foryou' && state.reason) showBanner(state.reason);
        updateCounts();

        if (!state.items.length && !state.hasMore) setStateMsg('empty');
        else if (state.items.length) setStateMsg(null);
        renderGrid(fresh, state.page > 1);
      } catch (e) {
        if (gen === feedGen) setStateMsg('error', e.message);
      } finally {
        state.loading = false;
        els.loader.hidden = true;
      }
    })();
    feedInFlight = task;
    await task;
  }

  function showBanner(text) {
    els.banner.hidden = false;
    els.banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M12 3l2.2 5.2L19.5 9l-4 3.7 1.1 5.5L12 15.4 7.4 18.2l1.1-5.5-4-3.7 5.3-.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>${escapeHtml(text)}</span>`;
  }

  function filtersActive() {
    return !!(
      state.query ||
      state.source !== 'all' ||
      state.orientation !== 'all' ||
      state.category !== 'all' ||
      state.minWidth !== '0'
    );
  }

  function clearFilters() {
    state.query = '';
    els.search.value = '';
    els.searchClear.hidden = true;
    state.source = 'all';
    state.orientation = 'all';
    state.category = 'all';
    state.minWidth = '0';
    state.sort = 'relevance';
    els.fCategory.dataset.for = '';
    renderSourceSelect();
    populateFilters();
    if (isFeedView()) loadFeed(true);
  }

  function setStateMsg(kind, detail) {
    if (!kind) {
      els.stateMsg.hidden = true;
      return;
    }
    els.stateMsg.hidden = false;
    if (kind === 'loading') {
      els.stateMsg.innerHTML = '<div class="big">Loading wallpapers…</div><div class="hint">Connecting to sources</div>';
    } else if (kind === 'empty') {
      const animHint =
        state.settings && state.settings.animatedOnly
          ? ' Animated-only filter is on — switch it off in the toolbar to include still images.'
          : '';
      let title;
      let hint;
      if (state.view === 'foryou' && !state.favorites.length) {
        title = 'Your feed is warming up';
        hint = 'Favorite a few wallpapers and recommendations will get personal — showing popular picks meanwhile';
      } else {
        const q = state.query ? ` for &ldquo;${escapeHtml(state.query)}&rdquo;` : '';
        title = `No wallpapers found${q}`;
        hint = `Try a different search or filter.${animHint}`;
      }
      const actions = filtersActive()
        ? '<div class="state-actions"><button class="ghost-btn" data-state-act="clear">Clear filters</button></div>'
        : '';
      els.stateMsg.innerHTML = `<div class="big">${title}</div><div class="hint">${hint}</div>${actions}`;
    } else if (kind === 'error') {
      els.stateMsg.innerHTML =
        '<div class="big">Couldn&rsquo;t reach this source</div>' +
        `<div class="hint">${escapeHtml(String(detail || '').slice(0, 160))}</div>` +
        '<div class="state-actions"><button class="primary-btn" data-state-act="retry">Try again</button></div>';
    }
  }

  // actions rendered inside the empty/error state messages
  els.stateMsg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-state-act]');
    if (!btn) return;
    const act = btn.dataset.stateAct;
    if (act === 'retry') loadFeed(true);
    else if (act === 'clear') clearFilters();
    else if (act === 'clearsearch') {
      els.search.value = '';
      runSearch();
    } else if (act === 'browse') setView('foryou');
    else if (act === 'upload') doUpload();
  });

  function renderCollection(items, emptyTitle, emptyHint, emptyAction) {
    els.grid.innerHTML = '';
    if (!items.length) {
      els.stateMsg.hidden = false;
      const btn = emptyAction
        ? `<div class="state-actions"><button class="ghost-btn" data-state-act="${escapeHtml(emptyAction.act)}">${escapeHtml(emptyAction.label)}</button></div>`
        : '';
      els.stateMsg.innerHTML = `<div class="big">${emptyTitle}</div><div class="hint">${emptyHint}</div>${btn}`;
      return;
    }
    els.stateMsg.hidden = true;
    renderGrid(items, false);
  }

  /* ---------------- grid ---------------- */

  function cardHtml(item) {
    const res = fmtRes(item);
    const local = isLocal(item);
    const fav = isFav(item.id);
    const status = state.status;
    const activeId = status && status.item ? status.item.id : null;
    const thumb = item.thumb || '';
    return `
      <article class="card ${activeId === item.id ? 'is-active' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="thumb" data-act="preview" style="${thumb ? `background-image:url('${thumb.replace(/'/g, '%27')}')` : ''}">
          ${thumb ? '' : `<div class="thumb-fallback">${escapeHtml((item.title || '?').charAt(0).toUpperCase())}</div>`}
          <div class="play-hint"><span>${ICONS.play}</span></div>
          <span class="badge">${escapeHtml(item.source)}</span>
          ${animLabel(item) ? `<span class="badge anim-badge">${animLabel(item)}</span>` : ''}
          ${item.nsfw ? '<span class="badge nsfw-badge">nsfw</span>' : ''}
          ${res ? `<span class="res">${res}</span>` : ''}
          <div class="card-actions">
            <button class="act-btn fav ${fav ? 'on' : ''}" data-act="fav" title="Favorite">${ICONS.heart}</button>
            ${local ? '' : `<button class="act-btn" data-act="download" title="Download">${ICONS.download}</button>`}
            <button class="act-btn" data-act="set" title="Set as wallpaper">${ICONS.set}</button>
            ${local ? `<button class="act-btn" data-act="remove" title="Remove">${ICONS.trash}</button>` : ''}
          </div>
        </div>
        <div class="meta">
          <div class="title" title="${escapeHtml(item.title || 'Untitled')}">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="sub">${escapeHtml(item.author || '')}${local ? ' · local' : ''}</div>
        </div>
      </article>`;
  }

  function renderGrid(items, append) {
    if (!append) els.grid.innerHTML = '';
    const frag = document.createElement('div');
    frag.innerHTML = items.map(cardHtml).join('');
    while (frag.firstChild) els.grid.appendChild(frag.firstChild);
    els.grid.querySelectorAll('.thumb').forEach((t) => {
      const bg = t.style.backgroundImage;
      if (!bg) return;
      const url = bg.slice(5, -2);
      const img = new Image();
      img.onload = () => { t.style.backgroundImage = `url("${url}")`; };
      img.onerror = () => {
        t.style.backgroundImage = '';
        if (!t.querySelector('.thumb-fallback')) {
          const fb = document.createElement('div');
          fb.className = 'thumb-fallback';
          fb.textContent = '◦';
          t.prepend(fb);
        }
      };
      img.src = url;
    });
  }

  function setupObserver() {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && isFeedView() && state.hasMore && !state.loading) {
          fetchPage();
        }
      },
      { root: els.scroll, rootMargin: '600px' }
    );
    io.observe(els.sentinel);
  }

  function findItem(id) {
    return (
      state.items.find((i) => i.id === id) ||
      state.favorites.find((i) => i.id === id) ||
      state.library.find((i) => i.id === id)
    );
  }

  /* ---------------- actions ---------------- */

  async function doPreview(item) {
    try {
      await api.invoke('wallpaper:apply', { item, persist: false });
      toast('Previewing on desktop…');
    } catch (e) {
      toast('Failed: ' + e, 'error');
    }
  }

  async function doSet(item) {
    try {
      await api.invoke('wallpaper:apply', { item, persist: true });
      toast('Wallpaper set', 'ok');
      refreshActiveCards();
    } catch (e) {
      toast('Failed: ' + e, 'error');
    }
  }

  async function doDownload(item) {
    toast('Downloading…');
    try {
      const entry = await api.invoke('library:download', item);
      state.library = await api.invoke('library:list');
      updateCounts();
      await api.invoke('wallpaper:apply', { item: entry, persist: true });
      toast(entry.alreadyLocal ? 'Already in your library' : 'Downloaded & set', 'ok');
      refreshActiveCards();
      api.invoke('app:playlistRefresh');
      if (state.view === 'local') setView('local');
    } catch (e) {
      toast('Download failed: ' + String(e.message || e), 'error');
    }
  }

  async function doFav(item, btn) {
    state.favorites = await api.invoke('favorites:toggle', item);
    updateCounts();
    const on = isFav(item.id);
    if (btn) btn.classList.toggle('on', on);
    api.invoke('app:playlistRefresh');
    if (state.view === 'favorites' && !on) {
      const card = btn && btn.closest('.card');
      if (card) card.remove();
      if (!els.grid.children.length) renderCollection([], 'No favorites yet', 'Tap the heart on any wallpaper to keep it here.');
    }
  }

  async function doRemove(item) {
    const confirmed = await confirmDialog({
      title: 'Remove wallpaper?',
      message: `“${item.title || 'Untitled'}” will be deleted from My Wallpapers. This cannot be undone.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    state.library = await api.invoke('library:remove', item.id);
    state.favorites = await api.invoke('favorites:list');
    updateCounts();
    const card = els.grid.querySelector(`.card[data-id="${cssEsc(item.id)}"]`);
    if (card) card.remove();
    toast('Removed from library');
    api.invoke('app:playlistRefresh');
    if (!els.grid.children.length) setView('local');
  }

  function refreshActiveCards() {
    const id = state.status && state.status.item ? state.status.item.id : null;
    els.grid.querySelectorAll('.card').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.id === id);
    });
  }

  els.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.card');
    if (!card) return;
    const item = findItem(card.dataset.id);
    if (!item) return;
    const act = btn.dataset.act;
    if (act === 'preview') {
      // already-downloaded wallpapers are set directly — no Keep/Discard bar
      if (isLocal(item)) doSet(item);
      else doPreview(item);
    } else if (act === 'set') doSet(item);
    else if (act === 'download') doDownload(item);
    else if (act === 'fav') doFav(item, btn);
    else if (act === 'remove') doRemove(item);
  });

  /* ---------------- status / preview bar ---------------- */

  function renderStatus() {
    const st = state.status;
    if (st && st.previewing && st.previewItem) {
      els.previewBar.hidden = false;
      els.pbText.textContent = `Previewing “${st.previewItem.title || 'Untitled'}”`;
    } else {
      els.previewBar.hidden = true;
    }
    if (st && st.item) {
      els.nowPlaying.hidden = false;
      els.nowPlaying.innerHTML = `Now playing: <b>${escapeHtml(st.item.title || 'Untitled')}</b>`;
    } else {
      els.nowPlaying.hidden = true;
      els.nowPlaying.innerHTML = '';
    }
    refreshActiveCards();
  }

  api.on('evt:wallpaper', (status) => {
    state.status = status;
    renderStatus();
  });

  // settings changed elsewhere (floating button, tray, another window):
  // refresh inputs so the Settings UI never shows a stale value. Inputs the
  // user is actively touching are skipped so we never fight their drag.
  api.on('wallpaper:settings', (s) => {
    if (!s) return;
    state.settings = s;
    applyChrome();
    $$('#settings-view [data-setting]').forEach((input) => {
      if (document.activeElement === input) return;
      const key = input.dataset.setting;
      const val = s[key];
      if (input.type === 'checkbox') input.checked = !!val;
      else input.value = val;
      updateValLabel(key, val);
    });
    renderSourceToggles();
  });

  $('#pb-discard').addEventListener('click', async () => {
    const hadPrevious = !!(state.status && state.status.previewOriginal);
    await api.invoke('wallpaper:discardPreview');
    toast(hadPrevious ? 'Restored previous wallpaper' : 'Preview discarded');
  });

  $('#pb-keep').addEventListener('click', () => {
    const st = state.status;
    if (st && st.previewItem) doDownload(st.previewItem);
  });

  /* ---------------- filters / search ---------------- */

  const runSearch = debounce(() => {
    state.query = els.search.value.trim();
    els.searchClear.hidden = !state.query;
    if (isFeedView()) loadFeed(true);
    else filterCollection();
  }, 420);

  function filterCollection() {
    const q = state.query.toLowerCase();
    const isFav = state.view === 'favorites';
    const base = isFav ? state.favorites : state.library;
    const filtered = q
      ? base.filter(
          (i) =>
            (i.title || '').toLowerCase().includes(q) ||
            (i.author || '').toLowerCase().includes(q) ||
            (i.source || '').toLowerCase().includes(q)
        )
      : base;
    // searching within a collection but nothing matched — say so specifically
    if (!filtered.length && q) {
      els.grid.innerHTML = '';
      els.stateMsg.hidden = false;
      els.stateMsg.innerHTML =
        `<div class="big">No matches for &ldquo;${escapeHtml(state.query)}&rdquo;</div>` +
        `<div class="hint">Nothing in ${isFav ? 'your favorites' : 'My Wallpapers'} matches that search.</div>` +
        '<div class="state-actions"><button class="ghost-btn" data-state-act="clearsearch">Clear search</button></div>';
      return;
    }
    renderCollection(
      filtered,
      isFav ? 'No favorites yet' : 'No wallpapers downloaded',
      isFav
        ? 'Tap the heart on any wallpaper to keep it here.'
        : 'Upload files or hit Download on any wallpaper.',
      isFav ? { label: 'Browse wallpapers', act: 'browse' } : { label: 'Upload files', act: 'upload' }
    );
  }

  els.search.addEventListener('input', runSearch);
  els.searchClear.addEventListener('click', () => {
    els.search.value = '';
    runSearch();
    els.search.focus();
  });

  els.fSource.addEventListener('change', () => {
    state.source = els.fSource.value;
    state.category = 'all';
    els.fCategory.dataset.for = '';
    populateFilters();
    if (isFeedView()) loadFeed(true);
  });
  els.fOrientation.addEventListener('change', () => {
    state.orientation = els.fOrientation.value;
    if (isFeedView()) loadFeed(true);
  });
  els.fCategory.addEventListener('change', () => {
    state.category = els.fCategory.value;
    if (isFeedView()) loadFeed(true);
  });
  els.fMinWidth.addEventListener('change', () => {
    state.minWidth = els.fMinWidth.value;
    if (isFeedView()) loadFeed(true);
  });
  els.fSort.addEventListener('change', () => {
    state.sort = els.fSort.value;
    if (isFeedView()) loadFeed(true);
  });
  els.fNsfw.addEventListener('change', () => {
    if (!state.settings || !state.settings.nsfwMode) {
      state.nsfw = false;
      els.fNsfw.checked = false;
      return;
    }
    state.nsfw = els.fNsfw.checked;
    if (isFeedView()) loadFeed(true);
  });

  async function onAnimatedOnlyChanged(v) {
    state.settings = { ...state.settings, animatedOnly: v };
    els.fAnimated.checked = v;
    const box = $('#settings-view [data-setting="animatedOnly"]');
    if (box) box.checked = v;
    state.sources = await api.invoke('app:sources');
    if (state.source !== 'all' && !state.sources.some((s) => s.id === state.source)) {
      state.source = 'all';
    }
    renderSourceSelect();
    if (isFeedView()) loadFeed(true);
    toast(v ? 'Animated only — still images hidden' : 'Showing all wallpapers', v ? 'ok' : '');
  }

  els.fAnimated.addEventListener('change', async () => {
    const v = els.fAnimated.checked;
    try {
      state.settings = await api.invoke('settings:set', { animatedOnly: v });
      await onAnimatedOnlyChanged(v);
    } catch (e) {
      toast('Could not update filter: ' + String(e.message || e), 'error');
    }
  });

  $('#btn-refresh').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 900);
    if (isFeedView()) loadFeed(true);
    else setView(state.view);
  });

  $$('.nav-item').forEach((n) => n.addEventListener('click', () => setView(n.dataset.view)));

  /* ---------------- upload / url ---------------- */

  async function doUpload() {
    const added = await api.invoke('library:upload');
    if (added && added.length) {
      state.library = await api.invoke('library:list');
      updateCounts();
      toast(`Imported ${added.length} wallpaper${added.length > 1 ? 's' : ''}`, 'ok');
      api.invoke('app:playlistRefresh');
      setView('local');
    }
  }

  $('#btn-upload').addEventListener('click', doUpload);

  function openModal() {
    els.modal.hidden = false;
    els.modalInput.value = '';
    setTimeout(() => els.modalInput.focus(), 50);
  }
  function closeModal() {
    els.modal.hidden = true;
  }
  $('#btn-addurl').addEventListener('click', openModal);
  $('#modal-cancel').addEventListener('click', closeModal);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
  });

  $('#modal-ok').addEventListener('click', async () => {
    const url = els.modalInput.value.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast('Enter a valid http(s) URL', 'error');
      return;
    }
    const ext = (url.split('?')[0].split('#')[0].match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
    const isVid = ['.mp4', '.webm', '.mov', '.mkv'].includes(ext);
    const isImg = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
    if (!isVid && !isImg) {
      toast('URL must point to an image or video file', 'error');
      return;
    }
    const item = {
      id: 'url:' + btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24),
      source: 'url',
      type: isVid ? 'video' : 'image',
      title: decodeURIComponent(url.split('/').pop().split('?')[0]),
      author: 'From URL',
      pageUrl: url,
      thumb: isImg ? url : null,
      full: url,
      width: 0,
      height: 0,
      category: 'url',
      tags: [],
      uploaded: true,
      addedAt: Date.now(),
    };
    closeModal();
    try {
      const saved = await api.invoke('library:download', item);
      state.library = await api.invoke('library:list');
      updateCounts();
      await api.invoke('wallpaper:apply', { item: saved, persist: true });
      toast('Added & set as wallpaper', 'ok');
      api.invoke('app:playlistRefresh');
      setView('local');
    } catch (e) {
      toast('Could not add URL: ' + String(e.message || e), 'error');
    }
  });

  /* ---------------- settings ---------------- */

  const VALUE_FORMATS = {
    speed: (v) => Number(v).toFixed(1) + '×',
    zoom: (v) => v + '%',
    transition: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 's' : v + 'ms'),
    parallaxDepth: (v) => v + '%',
    dim: (v) => v + '%',
    brightness: (v) => v + '%',
    saturation: (v) => v + '%',
    particleCount: (v) => v,
    clockSize: (v) => v + 'px',
    clockOffsetX: (v) => v + 'px',
    clockOffsetY: (v) => v + 'px',
    clockOpacity: (v) => v + '%',
    companionSize: (v) => v + 'px',
    companionOffsetX: (v) => v + 'px',
    companionOffsetY: (v) => v + 'px',
    companionOpacity: (v) => v + '%',
    toggleOffsetX: (v) => v + 'px',
    toggleOffsetY: (v) => v + 'px',
  };

  function bindSettings() {
    $$('#settings-view [data-setting]').forEach((input) => {
      const key = input.dataset.setting;
      const val = state.settings[key];
      if (input.type === 'checkbox') input.checked = !!val;
      else input.value = val;
      updateValLabel(key, val);

      const handler = async () => {
        let v;
        if (input.type === 'checkbox') v = input.checked;
        else if (input.type === 'range') v = Number(input.value);
        else v = input.value;
        if (key === 'playlistInterval' || key === 'clockSize') v = Number(v);

        // enabling NSFW removes every content limit — confirm before applying
        if (key === 'nsfwMode' && v) {
          const yes = await confirmDialog({
            title: 'Turn on NSFW mode?',
            message: 'This removes every content limit, so explicit wallpapers will appear in your feed. Continue only if you are of legal age and in a private space.',
            confirmLabel: 'Turn on NSFW',
            danger: true,
          });
          if (!yes) {
            input.checked = false;
            return;
          }
        }

        state.settings = await api.invoke('settings:set', { [key]: v });
        updateValLabel(key, v);
        applyChrome();

        if (key === 'nsfwMode') {
          state.nsfw = !!v;
          populateFilters();
          if (v) toast('NSFW mode on — all content limits removed (explicit included)', 'ok');
          if (isFeedView()) loadFeed(true);
        }
        if (key === 'animatedOnly') {
          await onAnimatedOnlyChanged(v);
        }
      };
      input.addEventListener(
        input.type === 'range' ? 'input' : 'change',
        debounce(handler, input.type === 'range' ? 120 : 0)
      );
    });
  }

  function updateValLabel(key, val) {
    const label = $(`#settings-view .val[data-for="${key}"]`);
    if (label) label.textContent = (VALUE_FORMATS[key] || ((v) => v))(val);
  }

  $('#btn-stop-wallpaper').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Stop wallpaper?',
      message: 'Your current wallpaper will be removed and your desktop will go back to the default background.',
      confirmLabel: 'Stop',
      danger: true,
    });
    if (!yes) return;
    await api.invoke('wallpaper:stop');
    toast('Wallpaper stopped — desktop restored');
  });

  /* ---------------- go ---------------- */

  boot().catch((e) => {
    console.error(e);
    setStateMsg('error', String(e.message || e));
  });
})();
