/* Pawn Ledger – security helpers (WebCrypto). Used by the app (login, data encryption) and by Setup (install, change password).
   Password -> PBKDF2-SHA256 (210,000 rounds) -> AES-256-GCM key. The data file is stored encrypted; without the password it is unreadable.
   The licence binds an installation to the drive serial number it was installed on. */
const Secure = (() => {
  const subtle = (globalThis.crypto || window.crypto).subtle, rnd = n => (globalThis.crypto || window.crypto).getRandomValues(new Uint8Array(n));
  const te = new TextEncoder(), td = new TextDecoder(), ITER = 210000;
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pw, salt, iter) {
    const base = await subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt: unb64(salt), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(key, obj) { const iv = rnd(12); return { v: 1, iv: b64(iv), ct: b64(new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))))) }; }
  async function decrypt(key, blob) { return JSON.parse(td.decode(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct)))); }
  async function makeAuth(pw, label) { const salt = b64(rnd(16)), key = await deriveKey(pw, salt, ITER); return { auth: { v: 1, iter: ITER, salt, label: label || '', check: await encrypt(key, { ok: 'pawnledger' }) }, key }; }
  async function checkAuth(auth, pw) { try { const key = await deriveKey(pw, auth.salt, auth.iter), r = await decrypt(key, auth.check); return r && r.ok === 'pawnledger' ? key : null; } catch (e) { return null; } }
  const sha = async s => b64(new Uint8Array(await subtle.digest('SHA-256', te.encode(s))));
  async function makeLicense(serial) { const id = b64(rnd(16)); return { v: 1, id, bind: await sha('PawnLedger|' + id + '|' + serial) }; }
  async function checkLicense(lic, serial) { return !!(lic && lic.id && serial && lic.bind === await sha('PawnLedger|' + lic.id + '|' + serial)); }
  return { deriveKey, encrypt, decrypt, makeAuth, checkAuth, makeLicense, checkLicense, b64, unb64 };
})();
if (typeof module !== 'undefined') module.exports = Secure;
