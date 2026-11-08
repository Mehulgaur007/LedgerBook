/* Pawn Ledger – licence codes (offline).
   Activation code = owner's digital signature of "PLACT|<Machine ID>".
   Admin code      = owner's digital signature of "PLADM|<Machine ID>|<YYYYMMDD>" (valid for that day only).
   Signatures are ECDSA P-256. This file holds only the PUBLIC (checking) key, so codes cannot be made from it. */
const Licence = (() => {
  const PUB = {"kty":"EC","x":"Z1QfN63RDIoGfnD2c93kvKpoVA1-cRPPJkRmT-qPSrI","y":"o-0RCPZC_5JCAH_ez_8cMSZp4WSXa_q1E9QFlVio1Ho","crv":"P-256"};
  const subtle = (globalThis.crypto || window.crypto).subtle, te = new TextEncoder();
  const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function enc32(u8) { let bits = 0, val = 0, out = ''; for (const b of u8) { val = ((val << 8) | b) & 0xffff; bits += 8; while (bits >= 5) { out += AL[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += AL[(val << (5 - bits)) & 31]; return out; }
  function dec32(s) { const out = []; let bits = 0, val = 0; for (const ch of s) { const i = AL.indexOf(ch); if (i < 0) return null; val = ((val << 5) | i) & 0xffff; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
  const clean = s => String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const group = (s, n = 5) => (s.match(new RegExp('.{1,' + n + '}', 'g')) || []).join('-');
  const cleanId = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ymdOf = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  let pubKey = null;
  const key = async () => pubKey || (pubKey = await subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
  async function check(code, msg) { const sig = dec32(clean(code)); if (!sig || sig.length !== 64) return false; try { return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await key(), sig, te.encode(msg)); } catch (e) { return false; } }
  const actMsg = id => 'PLACT|' + cleanId(id);
  const admMsg = (id, ymd) => 'PLADM|' + cleanId(id) + '|' + ymd;
  async function verifyActivation(id, code) { return !!cleanId(id) && check(code, actMsg(id)); }
  async function verifyAdmin(id, code, now = new Date()) {   // accepts yesterday / today / tomorrow (time zones, late evenings)
    if (!cleanId(id)) return false;
    for (const off of [0, -1, 1]) { const d = new Date(now); d.setDate(d.getDate() + off); if (await check(code, admMsg(id, ymdOf(d)))) return true; } return false;
  }
  return { verifyActivation, verifyAdmin, enc32, dec32, clean, group, cleanId, actMsg, admMsg, ymdOf };
})();
if (typeof module !== 'undefined') module.exports = Licence;
