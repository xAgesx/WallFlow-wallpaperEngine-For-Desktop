const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  effect: 'kenburns',
  speed: 1,
  zoom: 10,
  dim: 12,
  brightness: 100,
  saturation: 100,
  clock: true,
  clockFormat: '24',
  clockPosition: 'bottom-right',
  clockOffsetX: 0,
  clockOffsetY: 0,
  clockOpacity: 100,
  clockSize: 72,
  clockSeconds: false,
  particles: false,
  particleCount: 36,
  vignette: false,
  parallax: false,
  parallaxDepth: 14,
  companion: false,
  companionChar: 'cat',
  companionSize: 200,
  companionPosition: 'bottom-right',
  companionOffsetX: 0,
  companionOffsetY: 0,
  companionOpacity: 100,
  transition: 1100,
  playlist: false,
  playlistInterval: 300,
  playlistSource: 'library',
  shuffle: true,
  startWithWindows: false,
  trayOnClose: true,
  videoMuted: true,
  accent: '#8b9cff',
  theme: 'dark',
  density: 'comfortable',
  minimizeOnStart: false,
  wallhavenKey: '',
  pexelsKey: '',
  unsplashKey: '',
  pixabayKey: '',
  tenorKey: '',
  nsfwMode: false,
  animatedOnly: true,
  disabledSources: [],
  currentWallpaper: null,
};

function file(name) {
  return path.join(app.getPath('userData'), name);
}

function read(name, fallback) {
  try {
    const raw = fs.readFileSync(file(name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(name, data) {
  try {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.writeFileSync(file(name), JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('store write failed', name, e);
    return false;
  }
}

function getSettings() {
  const saved = read('settings.json', {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write('settings.json', next);
  return next;
}

function getFavorites() {
  return read('favorites.json', []);
}

function setFavorites(list) {
  write('favorites.json', list);
}

function getLibrary() {
  return read('library.json', []);
}

function setLibrary(list) {
  write('library.json', list);
}

function wallpapersDir() {
  const dir = path.join(app.getPath('userData'), 'wallpapers');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  getFavorites,
  setFavorites,
  getLibrary,
  setLibrary,
  wallpapersDir,
};
