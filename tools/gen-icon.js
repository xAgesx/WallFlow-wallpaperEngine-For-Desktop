/* Rasterize the official logo (public/WallFlow-icon.svg) into the binary icons
 * the app needs at runtime and for packaging:
 *
 *   assets/icon.png  - 512x512, used by the tray
 *   assets/icon.ico  - multi-size (16/24/32/48/64/128/256), used by the
 *                      window + taskbar (Windows needs a real ICO with a
 *                      32px entry or the taskbar shows a blank icon) and
 *                      by electron-builder for the exe/installer.
 *
 * Uses the bundled Electron binary to render (canvas draw of the SVG), so no
 * extra native dependencies are needed. Run with: npm run gen-icon
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SIZE = 512;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// stay clear of the running app's profile
app.setPath('userData', path.join(os.tmpdir(), 'wallflow-genicon'));
app.disableHardwareAcceleration();

/* Multi-entry ICO wrapping PNG payloads (supported since Vista). The
 * width/height byte is 0 when that dimension is 256. */
function pngToIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4); // entry count
  const dirSize = header.length + entries.length * 16;
  let offset = dirSize;
  const dirs = [];
  for (const e of entries) {
    const d = Buffer.alloc(16);
    d[0] = e.size >= 256 ? 0 : e.size; // width
    d[1] = e.size >= 256 ? 0 : e.size; // height
    d.writeUInt16LE(1, 4); // planes
    d.writeUInt16LE(32, 6); // bit count
    d.writeUInt32LE(e.png.length, 8);
    d.writeUInt32LE(offset, 12); // data offset
    dirs.push(d);
    offset += e.png.length;
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)]);
}

const toBuf = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

app.whenReady()
  .then(async () => {
    const svgPath = path.join(__dirname, '..', 'public', 'WallFlow-icon.svg');
    const svg = fs.readFileSync(svgPath, 'utf8');

    const win = new BrowserWindow({
      width: SIZE,
      height: SIZE,
      show: false,
      frame: false,
      webPreferences: { backgroundThrottling: false },
    });

    const html =
      '<!doctype html><meta charset="utf-8">' +
      '<style>html,body{margin:0;background:transparent}img{display:block;width:' +
      SIZE +
      'px;height:' +
      SIZE +
      'px}</style>' +
      '<img id="logo" alt="" src="data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(svg) +
      '">';

    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    const out = JSON.parse(
      await win.webContents.executeJavaScript(
        `(async () => {
          const img = document.getElementById('logo');
          await img.decode();
          const draw = (s) => {
            const c = document.createElement('canvas');
            c.width = c.height = s;
            c.getContext('2d').drawImage(img, 0, 0, s, s);
            return c.toDataURL('image/png');
          };
          const ico = {};
          for (const s of ${JSON.stringify(ICO_SIZES)}) ico[s] = draw(s);
          return JSON.stringify({ big: draw(${SIZE}), ico });
        })()`,
        true
      )
    );

    const assetsDir = path.join(__dirname, '..', 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), toBuf(out.big));
    const entries = ICO_SIZES.map((s) => ({ size: s, png: toBuf(out.ico[s]) }));
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), pngToIco(entries));

    console.log('icon written: assets/icon.png (512), assets/icon.ico (multi-size)');
    app.quit();
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });

// watchdog so a hung render never leaves a stray electron process
setTimeout(() => {
  console.error('gen-icon timed out');
  app.exit(1);
}, 20000);
