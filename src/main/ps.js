/* Spawn a PowerShell script by path.
 *
 * In a packaged (ASAR) build the .ps1 files live inside app.asar. Node's fs
 * can read them there, but PowerShell's -File parameter cannot - it rejects
 * the path with "does not exist". So we read the script via fs and re-emit it
 * to a temp file outside the archive before handing it to PowerShell. Works
 * identically in dev (real files) and packaged (ASAR). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function spawnPsScript(scriptPath, args = []) {
  const src = fs.readFileSync(scriptPath, 'utf8');
  const tmp = path.join(os.tmpdir(), `wallflow-${path.basename(scriptPath, '.ps1')}-${process.pid}.ps1`);
  fs.writeFileSync(tmp, src, 'utf8');
  const ps = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp, ...args],
    { windowsHide: true }
  );
  // the temp file is only needed while the process runs
  ps.on('close', () => {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  });
  return ps;
}

module.exports = { spawnPsScript };
