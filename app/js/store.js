/* Pawn Ledger – storage and licence layer (same design as SilverBook v16).
   Host "windows" : Electron (window.PLHost from preload.js) – files in %APPDATA%\PawnLedger\vault
   Host "android" : Capacitor app – files in the app's private storage
   Both hosts     : Machine ID + owner activation code + password; data AES-256 encrypted with the password.
   No host        : online preview in a browser – data in this browser only, simple preview password. */
const Store = (() => {
  let mode = 'browser', gate = null, host = null, machine = '', auth = null, key = null, admin = false, timer = null, pending = null, failed = false;
  function androidHost() {
    const P = 'plv:', ls = window.localStorage, AL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const id = () => { let v = ls.getItem(P + 'id'); if (!v) { const r = crypto.getRandomValues(new Uint8Array(12)); v = Array.from(r, b => AL[b % AL.length]).join('').replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3'); ls.setItem(P + 'id', v); } return v; };
    return { platform: 'android', id: async () => id(), get: async n => ls.getItem(P + 'f:' + n), set: async (n, t) => { ls.setItem(P + 'f:' + n, t); return true; }, del: async n => { ls.removeItem(P + 'f:' + n); return true; },
      daily: async () => true, erase: async () => { Object.keys(ls).filter(k => k.startsWith(P)).forEach(k => ls.removeItem(k)); return true; }, uninstall: async () => false };
  }
  function findHost() {
    if (typeof window === 'undefined') return null;
    if (window.PLHost) return window.PLHost;
    try { if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return androidHost(); } catch (e) { }
    return null;
  }
  async function init() {
    host = findHost(); if (!host) { mode = 'browser'; return; }
    mode = 'secure'; gate = 'starterror';
    machine = await host.id();
    let lic = null; try { const t = await host.get('licence.json'); lic = t ? JSON.parse(t) : null; } catch (e) { }
    if (!lic) { gate = 'activate'; return; }
    if (!(await Licence.verifyActivation(machine, lic.code))) { gate = 'wronglicense'; return; }
    const at = await host.get('auth.json'); auth = at ? JSON.parse(at) : null; gate = auth ? 'login' : 'setpw';
  }
  async function activate(code) {
    if (!(await Licence.verifyActivation(machine, code))) return false;
    await host.set('licence.json', JSON.stringify({ v: 1, machine, code: Licence.clean(code), at: new Date().toISOString() }));
    const at = await host.get('auth.json'); auth = at ? JSON.parse(at) : null; gate = auth ? 'login' : 'setpw'; return true;
  }
  async function setPassword(label, pw, fresh) {
    if (gate !== 'setpw') throw new Error('not allowed');
    const r = await Secure.makeAuth(pw, label); auth = r.auth; key = r.key;
    await host.set('data.enc', JSON.stringify(await Secure.encrypt(key, fresh))); await host.set('auth.json', JSON.stringify(auth)); gate = null; return fresh;
  }
  async function unlock(pw, fresh) {
    const k = await Secure.checkAuth(auth, pw); if (!k) return null;
    const t = (await host.get('data.enc')) || ''; const d = t.trim() ? await Secure.decrypt(k, JSON.parse(t)) : fresh;
    key = k; gate = null; return d;
  }
  async function lock() { if (timer) { clearTimeout(timer); timer = null; await push(); } key = null; admin = false; gate = 'login'; }
  async function adminCheck(code) { admin = await Licence.verifyAdmin(machine, code); return admin; }
  const needAdmin = () => { if (!admin) throw new Error('Enter today’s owner admin code first.'); };
  async function changePassword(oldPw, newPw, fresh) {   // owner only – keeps all data and re-encrypts it with the new password
    needAdmin(); const k = await Secure.checkAuth(auth, oldPw); if (!k) throw new Error('The current password is wrong.');
    const t = await host.get('data.enc'), d = t && t.trim() ? await Secure.decrypt(k, JSON.parse(t)) : fresh;
    const r = await Secure.makeAuth(newPw, auth.label); await host.set('backup-before-password-change.enc', t || '');
    await host.set('data.enc', JSON.stringify(await Secure.encrypt(r.key, d))); await host.set('auth.json', JSON.stringify(r.auth)); auth = r.auth; return true;
  }
  async function resetPassword(newPw, fresh) {   // owner only – password forgotten: old data kept aside (still locked), a fresh ledger starts
    needAdmin(); const t = await host.get('data.enc'); if (t && t.trim()) await host.set('locked-data-' + new Date().toISOString().slice(0, 10) + '.enc', t);
    const r = await Secure.makeAuth(newPw, auth && auth.label); auth = r.auth; if (auth.label) fresh.settings.biz = auth.label;
    await host.set('data.enc', JSON.stringify(await Secure.encrypt(r.key, fresh))); await host.set('auth.json', JSON.stringify(auth)); gate = 'login'; return true;
  }
  async function eraseAll() { needAdmin(); await host.erase(); key = null; auth = null; gate = 'erased'; return true; }
  async function push() {
    if (mode !== 'secure' || !key || !pending) return;
    try { const t = JSON.stringify(await Secure.encrypt(key, pending)); if (!(await host.set('data.enc', t))) throw new Error('save'); await host.daily(t); failed = false; }
    catch (e) { if (!failed) { failed = true; alert('Could not save. Please close and reopen Pawn Ledger.'); } }
  }
  function persist(d) { pending = d; clearTimeout(timer); timer = setTimeout(() => { timer = null; push(); }, 250); }
  async function backupText(d) { return mode === 'secure' ? JSON.stringify(Object.assign({ pawnledger: 1, salt: auth.salt, iter: auth.iter }, await Secure.encrypt(key, d))) : JSON.stringify(d); }
  async function readBackup(text, pw) {
    const d = JSON.parse(text); if (!(d.ct && d.iv)) return d;
    if (mode !== 'secure' || !key) throw new Error('enc');
    const k = d.salt === auth.salt ? key : await Secure.deriveKey(pw || '', d.salt, d.iter);
    return Secure.decrypt(k, d);
  }
  return { init, activate, setPassword, unlock, lock, adminCheck, changePassword, resetPassword, eraseAll, persist, backupText, readBackup,
    uninstall: () => host && host.uninstall(), get mode() { return mode; }, get gate() { return gate; }, set gate(v) { gate = v; },
    get machine() { return machine; }, get admin() { return admin; }, get platform() { return host ? host.platform : 'web'; }, get label() { return auth && auth.label || ''; } };
})();
