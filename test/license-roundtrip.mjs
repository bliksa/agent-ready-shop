// Proves node-minted keys verify with the exact logic the plugin uses
// (base32 decode + Ed25519 verify with the public key), and that tampering fails.
import crypto from 'crypto';
import fs from 'fs';
import { issueLicense } from '../src/utils/license.ts';

const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32dec(s) {
  s = s.toUpperCase().split('').filter(c => ALPH.includes(c)).join('');
  let bits = '';
  for (const c of s) bits += ALPH.indexOf(c).toString(2).padStart(5, '0');
  const n = Math.floor(bits.length / 8);
  const o = Buffer.alloc(n);
  for (let i = 0; i < n; i++) o[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return o;
}

const sec = JSON.parse(fs.readFileSync('secrets/ars-license.json', 'utf8'));
const pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: sec.jwk.x }, format: 'jwk' });

function pluginVerify(key) {
  const blob = b32dec(key);
  const i = blob.indexOf(0x1f);
  if (i < 0) return { valid: false, err: 'no separator' };
  const payload = blob.subarray(0, i), sig = blob.subarray(i + 1);
  if (sig.length !== 64) return { valid: false, err: 'bad sig len ' + sig.length };
  return { valid: crypto.verify(null, payload, pub, sig), payload: payload.toString() };
}

const lic = issueLicense({ plan: 'pro', features: '*', expires: 'never' });
const v = pluginVerify(lic.key);
// Flip a character in the middle (signature bytes) so a real byte changes.
const raw = lic.key.replace(/-/g, '').split('');
raw[30] = raw[30] === 'Q' ? 'R' : 'Q';
const t = pluginVerify(raw.join(''));

console.log('minted   :', lic.key.slice(0, 45) + '…  (' + lic.key.length + ' chars)');
console.log('verify   :', JSON.stringify(v));
console.log('tampered :', JSON.stringify(t));

const b64u2b = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };
const sk = Buffer.concat([Buffer.from(b64u2b(sec.jwk.d), 'base64'), Buffer.from(b64u2b(sec.jwk.x), 'base64')]);
console.log('sodium_sk:', sk.toString('base64'), '(' + sk.length + ' bytes, for the PHP CLI)');

const ok = v.valid === true && t.valid === false;
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
