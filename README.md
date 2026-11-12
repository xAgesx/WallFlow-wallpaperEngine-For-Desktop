# WallFlow

A lightweight **animated wallpaper engine for Windows desktop**, built with Electron. Wallpaper renders *behind* your desktop icons as a live layer, with a library browser, playlist rotation, and an optional animated companion pet.

> Status: v1.0.0 — MIT licensed.

## Features

- **Live wallpapers behind your desktop icons** — the wallpaper window is attached to the desktop (WorkerW), not drawn on top of it.
- **Wallpaper library** — search and browse wallpapers from many sources in one place:
  - Wallhaven, Pexels, Unsplash, Pixabay, Wikimedia, NASA
  - Art Institute of Chicago, Cleveland Museum, The Met
  - Motion videos, animated GIFs, Tenor
  - Anime: Anime, Konachan
- **Playlist rotation** — auto-rotate wallpapers on an interval, with shuffle.
- **Companion pet** — an animated cat, dog, or blob that reacts on your desktop (cursor tracking, yawns, zzz's…).
- **Overlays** — clock/date overlay, dim & vignette, particle effects, parallax on cursor movement.
- **Tray app** — lives in the system tray; stop/resume the wallpaper, start with Windows, minimize-on-start.
- **API keys optional** — some sources (Pexels, Unsplash, Pixabay, Tenor, Wallhaven) work better with a free API key, configurable in Settings.

## Requirements

- **Windows** (uses PowerShell + Win32 APIs to attach the wallpaper to the desktop)
- [Node.js](https://nodejs.org) (LTS recommended) with npm

## Getting started

```bash
git clone https://github.com/xAgesx/WallFlow-wallpaperEngine-For-Desktop.git
cd WallFlow-wallpaperEngine-For-Desktop
npm install
npm start
```

## Usage

- Open the **Library** window, search or pick a source, then click a wallpaper to apply it.
- Right-click the tray icon to stop/resume the wallpaper or exit.
- **Settings** (in the Library window) controls animation, look, clock overlay, companion, playlist rotation, API keys, source visibility, and general behavior.

## Project structure

```
src/
  main/       Electron main process: window/tray management, wallpaper engine,
              source APIs, settings store, PowerShell helpers (attach, sensors, autostart)
  library/    Library/settings UI (HTML/CSS/JS)
  wallpaper/  Wallpaper renderer: media layers, overlays, particles,
              clock, companion pet
  preload.js  IPC bridge between renderer and main process
tools/        Dev utilities (icon generation, source checker)
assets/       App icon
```

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the app with Electron |
| `npm run gen-icon` | Regenerate `assets/icon.png` |

## License

[MIT](LICENSE)
