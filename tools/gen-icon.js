/* Rasterize the official logo (public/WallFlow-icon.svg) into the binary icons
 * the app needs at runtime and for packaging:
 *
 *   assets/icon.png  - 512x512, used by the window, taskbar and tray
 *   assets/icon.ico  - 256x256, used by electron-builder for the exe/installer
 *
 * Uses the bundled Electron binary to render (canvas draw of the SVG), so no
 * extra native dependencies are needed. Run with: npm run gen-icon
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SIZE = 512;
const ICO_SIZE = 256;

// stay clear of the running app's profile
app.setPath('userData', path.join(os.tmpdir(), 'wallflow-genicon'));
app.disableHardwareAcceleration();

/* Single-entry ICO wrapping a PNG payload (supported since Vista). The
 * width/height byte is 0 because 256 is encoded as 0 in the entry header. */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // entry count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width (0 = 256)
  entry[1] = 0; // height (0 = 256)
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // data offset
  return Buffer.concat([header, entry, png]);
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
          return JSON.stringify({ big: draw(${SIZE}), ico: draw(${ICO_SIZE}) });
        })()`,
        true
      )
    );

    const assetsDir = path.join(__dirname, '..', 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), toBuf(out.big));
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), pngToIco(toBuf(out.ico)));

    console.log('icon written: assets/icon.png (512), assets/icon.ico (256)');
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
