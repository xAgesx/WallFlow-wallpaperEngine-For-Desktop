/* WallFlow wallpaper renderer */
(() => {
  const stage = document.getElementById('stage');
  const layers = [document.getElementById('layerA'), document.getElementById('layerB')];
  const dimEl = document.querySelector('.overlay-dim');
  const vigEl = document.querySelector('.overlay-vignette');
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  const clockEl = document.getElementById('clock');
  const timeEl = clockEl.querySelector('.time');
  const dateEl = clockEl.querySelector('.date');
  const companionEl = document.getElementById('companion');
  const companion = window.wallflowCompanion || null;

  let active = 0;
  let settings = null;
  let currentItem = null;
  let parallax = { x: 0, y: 0 };
  let particles = [];
  let rafId = null;
  let clockTimer = null;

  const EFFECTS = ['kenburns', 'pan', 'zoom', 'drift', 'tilt', 'none'];

  function isAnimatedItem(item) {
    if (!item) return false;
    if (item.type === 'video') return true;
    if (item.animated) return true;
    return /\.gif(\?|#|$)/i.test(String(item.full || item.thumb || ''));
  }

  function fileUrlToPath(url) {
    if (!url || !url.startsWith('file://')) return null;
    try { return decodeURIComponent(url.replace('file:///', '').replace(/^([A-Za-z]:)/, '$1')); } catch { return null; }
  }

  function buildMediaEl(item, settings) {
    const isVideo = item.type === 'video';
    const realMotion = isAnimatedItem(item);
    let el;
    if (isVideo) {
      el = document.createElement('video');
      el.className = 'media';
      el.src = item.full;
      el.muted = settings.videoMuted !== false;
      el.loop = true;
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      if (item.thumb) el.poster = item.thumb;
      el.addEventListener('error', () => {
        // one retry with the lower-res fallback before giving up on the video
        if (item.fallback && el.src !== item.fallback && !el.dataset.retried) {
          el.dataset.retried = '1';
          el.src = item.fallback;
          el.play().catch(() => {});
          return;
        }
        if (item.thumb && el.poster !== item.thumb) {
          // fall back to static thumb as background
          const div = document.createElement('div');
          div.className = 'media';
          div.style.backgroundImage = `url("${item.thumb}")`;
          el.replaceWith(div);
          applyEffect(div, item, settings);
        }
      });
      el.play().catch(() => {});
    } else if (realMotion) {
      // animated image (GIF): render as <img> so playback is guaranteed
      el = document.createElement('img');
      el.className = 'media';
      el.src = item.full || item.thumb;
      el.addEventListener('error', () => {
        if (item.thumb && el.getAttribute('src') !== item.thumb) el.src = item.thumb;
      }, { once: true });
    } else {
      el = document.createElement('div');
      el.className = 'media';
      const src = item.full || item.thumb;
      el.style.backgroundImage = `url("${src}")`;
      if (item.thumb && item.thumb !== src) {
        const probe = new Image();
        probe.onerror = () => { el.style.backgroundImage = `url("${item.thumb}")`; };
        probe.src = src;
      }
    }
    applyEffect(el, item, settings);
    return el;
  }

  function applyEffect(el, item, s) {
    if (!s) return;
    // color grade everything; never fake-animate media that already moves on its own
    el.style.filter = `brightness(${s.brightness || 100}%) saturate(${s.saturation || 100}%)`;
    el.classList.remove(...EFFECTS.map((e) => 'fx-' + e));
    el.style.transform = '';
    if (isAnimatedItem(item)) return;

    const speed = Math.max(0.1, Number(s.speed) || 1);
    const base = { kenburns: 26, pan: 30, zoom: 14, drift: 34 }[s.effect] || 26;
    const dur = (base / speed).toFixed(1) + 's';
    el.style.setProperty('--dur', dur);
    el.style.setProperty('--zoom-max', String(1.04 + (Number(s.zoom) || 10) / 100));

    if (s.effect && s.effect !== 'none') el.classList.add('fx-' + s.effect);

    if (s.effect === 'kenburns') {
      const flip = hash(item.id || '') % 2 === 0;
      el.style.setProperty('--kb-keyframes', flip ? 'kb-a' : 'kb-b');
    }
    if (s.effect === 'pan') {
      const horiz = hash(item.id || '') % 2 === 0;
      el.style.setProperty('--pan-keyframes', horiz ? 'pan-x' : 'pan-y');
    }
    if (s.effect === 'tilt') {
      updateTilt(el);
    }
  }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function updateTilt(el) {
    if (!settings || settings.effect !== 'tilt' || isAnimatedItem(currentItem)) return;
    const d = (Number(settings.parallaxDepth) || 14) / 100;
    const scale = 1.1;
    const tx = -parallax.x * d * 100;
    const ty = -parallax.y * d * 100;
    el.style.transform = `scale(${scale}) translate(${tx}%, ${ty}%)`;
  }

  function show(item, s, transition) {
    settings = s;
    currentItem = item;
    const nextIdx = transition ? 1 - active : active;
    const next = layers[nextIdx];
    const prev = layers[active];

    // reuse current media if same item (settings-only refresh)
    if (prev.dataset.itemId === item.id && nextIdx === active) {
      const media = prev.querySelector('.media');
      if (media) applyEffect(media, item, s);
      applyOverlays(s);
      return;
    }

    next.innerHTML = '';
    const media = buildMediaEl(item, s);
    next.appendChild(media);
    next.dataset.itemId = item.id;

    if (transition && prev.dataset.itemId) {
      next.classList.add('active');
      prev.classList.remove('active');
      setTimeout(() => {
        if (prev !== layers[active]) return;
        prev.innerHTML = '';
        delete prev.dataset.itemId;
      }, (Number(s.transition) || 1100) + 200);
      active = nextIdx;
    } else {
      layers.forEach((l) => l.classList.remove('active'));
      next.classList.add('active');
      active = nextIdx;
    }
    applyOverlays(s);
  }

  function applyOverlays(s) {
    stage.style.setProperty('--transition', (Number(s.transition) || 1100) + 'ms');
    dimEl.style.opacity = String(Math.min(0.85, Math.max(0, (Number(s.dim) || 0) / 100)));
    vigEl.classList.toggle('on', !!s.vignette);
    clockEl.className = '';
    if (s.clock) {
      clockEl.classList.add('on', s.clockPosition || 'bottom-right');
      clockEl.style.setProperty('--clock-size', (Number(s.clockSize) || 72) + 'px');
      clockEl.style.setProperty('--off-x', (Number(s.clockOffsetX) || 0) + 'px');
      clockEl.style.setProperty('--off-y', (Number(s.clockOffsetY) || 0) + 'px');
      clockEl.style.setProperty(
        '--op',
        String(Math.min(1, Math.max(0.1, (Number(s.clockOpacity) || 100) / 100)))
      );
      tickClock();
    }
    canvas.classList.toggle('on', !!s.particles);
    if (s.particles) startParticles(); else stopParticles();
    if (companion) {
      const char = s.companionChar || 'cat';
      const pos = s.companionPosition || 'bottom-right';
      companion.setCharacter(char);
      companionEl.className = s.companion ? `on ${pos} as-${char}` : '';
      companionEl.style.setProperty(
        '--companion-size',
        (Number(s.companionSize) || 200) + 'px'
      );
      companionEl.style.setProperty('--off-x', (Number(s.companionOffsetX) || 0) + 'px');
      companionEl.style.setProperty('--off-y', (Number(s.companionOffsetY) || 0) + 'px');
      companionEl.style.setProperty(
        '--op',
        String(Math.min(1, Math.max(0.1, (Number(s.companionOpacity) || 100) / 100)))
      );
      companion.setPositionHint(pos);
      companion.setEnabled(!!s.companion);
    }
    const media = layers[active].querySelector('.media');
    if (media) applyEffect(media, currentItem, s);
    updateTiltAll();
  }

  function updateTiltAll() {
    if (!settings || settings.effect !== 'tilt') return;
    layers.forEach((l) => {
      const m = l.querySelector('.media');
      if (m) updateTilt(m);
    });
  }

  /* ---------- clock ---------- */

  function tickClock() {
    if (!settings || !settings.clock) return;
    const now = new Date();
    const h24 = settings.clockFormat !== '12';
    let h = now.getHours();
    let suffix = '';
    if (!h24) {
      suffix = h >= 12 ? ' PM' : ' AM';
      h = h % 12 || 12;
    }
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const showSec = !!settings.clockSeconds;
    timeEl.textContent = `${h24 ? String(h).padStart(2, '0') : h}:${m}${showSec ? ':' + s : ''}${suffix}`;
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  /* ---------- particles ---------- */

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function startParticles() {
    resizeCanvas();
    if (particles.length === 0) seedParticles();
    if (!rafId) loopParticles();
  }

  function stopParticles() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function seedParticles() {
    const count = Math.max(0, Math.min(160, Number(settings?.particleCount) || 36));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.6 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.08 - Math.random() * 0.3,
      a: 0.15 + Math.random() * 0.5,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  function loopParticles() {
    rafId = requestAnimationFrame(loopParticles);
    if (!settings?.particles) return;
    if (particles.length !== Math.max(0, Math.min(160, Number(settings.particleCount) || 36))) seedParticles();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx + parallax.x * 0.15;
      p.y += p.vy;
      p.tw += 0.02;
      if (p.y < -8) { p.y = canvas.height + 8; p.x = Math.random() * canvas.width; }
      if (p.x < -8) p.x = canvas.width + 8;
      if (p.x > canvas.width + 8) p.x = -8;
      const alpha = p.a * (0.65 + 0.35 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- ipc ---------- */

  window.wallflow.on('wallpaper:show', (data) => {
    const prevId = currentItem && currentItem.id;
    show(data.item, data.settings, data.transition);
    // a new wallpaper landing = the companion notices (stretch / blink / hop)
    if (companion && prevId && prevId !== data.item.id) companion.onWallpaperChange();
  });

  window.wallflow.on('wallpaper:settings', (s) => {
    const prev = settings;
    settings = s;
    if (currentItem) show(currentItem, s, false);
    if (companion && prev) {
      // brightness diff → companion reaction (up = squint, down = yawn)
      const bd = (Number(s.brightness) || 100) - (Number(prev.brightness) || 100);
      if (bd !== 0) companion.onBrightness(bd);
      else if (Object.keys(s).some((k) => s[k] !== prev[k])) companion.onNotice();
    }
  });

  window.wallflow.on('wallpaper:parallax', (p) => {
    parallax = p;
    updateTiltAll();
    if (companion) companion.setCursor(p);
  });

  // mouse buttons + system volume streamed from the main process sensors
  window.wallflow.on('wallpaper:event', (ev) => {
    if (companion) companion.onEvent(ev);
  });

  window.addEventListener('resize', () => {
    if (settings?.particles) { resizeCanvas(); seedParticles(); }
  });

  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(tickClock, 1000);
})();
