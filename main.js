// PawnLedger – Windows desktop app (Electron main process).
// Opens the app window, gives it the Machine ID, and stores its ENCRYPTED files in %APPDATA%\PawnLedger\vault.
// The page itself does all password checks and encryption; this file only reads/writes files.
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path'), fs = require('fs'), crypto = require('crypto'), { execFileSync, spawn } = require('child_process');

app.setPath('userData', path.join(app.getPath('appData'), 'PawnLedger'));   // fixed location (the uninstaller relies on it)
const ROOT = app.getPath('userData'), VAULT = path.join(ROOT, 'vault'), BACKUP = path.join(VAULT, 'backup'), LOG = path.join(ROOT, 'pawnledger.log');
const FLAG = path.join(ROOT, 'allow-uninstall.flag');
const okName = n => typeof n === 'string' && /^[a-z0-9][a-z0-9.\-]{0,80}$/.test(n);
const log = m => { try { fs.appendFileSync(LOG, new Date().toISOString() + '  ' + m + '\r\n'); } catch (e) { } };

function machineId() {   // stable per Windows installation: hash of the Windows MachineGuid (never shown in plain form)
  let raw = '';
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { encoding: 'utf8', windowsHide: true });
    const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/); if (m) raw = m[1].toLowerCase();
  } catch (e) { log('MachineGuid not read: ' + e.message); }
  if (!raw) raw = 'host:' + require('os').hostname();          // fallback (should not happen on Windows)
  const h = crypto.createHash('sha256').update('PawnLedger-machine|' + raw).digest();
  const AL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 12; i++) s += AL[h[i] % AL.length];
  return s.replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');
}
let MID = null;
const ensure = d => fs.mkdirSync(d, { recursive: true });
function writeAtomic(file, text) { ensure(path.dirname(file)); const tmp = file + '.tmp'; fs.writeFileSync(tmp, text, 'utf8'); fs.renameSync(tmp, file); }

ipcMain.handle('pl:id', () => MID || (MID = machineId()));
ipcMain.handle('pl:get', (e, n) => { if (!okName(n)) return null; const f = path.join(VAULT, n); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; });
ipcMain.handle('pl:set', (e, n, t) => { if (!okName(n) || typeof t !== 'string') return false; try { writeAtomic(path.join(VAULT, n), t); return true; } catch (err) { log('save failed: ' + err.message); return false; } });
ipcMain.handle('pl:del', (e, n) => { if (!okName(n)) return false; try { fs.rmSync(path.join(VAULT, n), { force: true }); return true; } catch (err) { return false; } });
ipcMain.handle('pl:daily', (e, t) => {   // one encrypted safety copy per day, last 60 kept
  try {
    ensure(BACKUP); const f = path.join(BACKUP, 'data-' + new Date().toISOString().slice(0, 10) + '.enc'); if (!fs.existsSync(f)) fs.writeFileSync(f, t, 'utf8');
    const all = fs.readdirSync(BACKUP).filter(x => x.endsWith('.enc')).sort(); while (all.length > 60) fs.rmSync(path.join(BACKUP, all.shift()), { force: true });
    return true;
  } catch (err) { return false; }
});
ipcMain.handle('pl:erase', () => { try { fs.rmSync(VAULT, { recursive: true, force: true }); fs.writeFileSync(FLAG, 'erased ' + new Date().toISOString()); log('erased by owner'); return true; } catch (err) { log('erase failed: ' + err.message); return false; } });
ipcMain.handle('pl:uninstall', () => {   // after an owner-approved erase: start the Windows uninstaller and close
  if (!fs.existsSync(FLAG)) return false;
  const un = path.join(path.dirname(process.execPath), 'Uninstall Pawn Ledger.exe');
  if (!fs.existsSync(un)) { log('uninstaller not found: ' + un); return false; }
  spawn(un, [], { detached: true, stdio: 'ignore' }).unref(); setTimeout(() => app.quit(), 800); return true;
});
ipcMain.on('pl:log', (e, m) => log('PAGE: ' + String(m).slice(0, 2000)));

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 900, minHeight: 600, show: false, backgroundColor: '#0a0b16', title: 'Pawn Ledger',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('before-input-event', (e, i) => {   // no zoom, no reload, no developer tools
    const k = (i.key || '').toLowerCase();
    if ((i.control || i.meta) && ['+', '-', '=', '_', '0', 'r'].includes(k)) e.preventDefault();
    if (k === 'f5' || k === 'f12' || ((i.control || i.meta) && i.shift && k === 'i')) e.preventDefault();
  });
  win.webContents.on('zoom-changed', () => win.webContents.setZoomFactor(1));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { ensure(VAULT); try { fs.rmSync(FLAG, { force: true }); } catch (e) { } log('start v' + app.getVersion()); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
