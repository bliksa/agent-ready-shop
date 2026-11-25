/**
 * Server-side license minting — Ed25519 signed (asymmetric).
 *
 * The private key lives only here (env ARS_LICENSE_JWK or secrets/ars-license.json).
 * The WordPress plugin ships ONLY the public key and verifies signatures, so a
 * public plugin download cannot be used to forge keys.
 *
 * NODE ONLY. Do not import from client code.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32enc(buf: Buffer): string {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += ALPH[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

function loadPrivateKey(): crypto.KeyObject {
  let jwk: any;
  if (process.env.ARS_LICENSE_JWK) {
    jwk = JSON.parse(process.env.ARS_LICENSE_JWK);
  } else {
    const file = path.join(process.cwd(), 'secrets', 'ars-license.json');
    if (!fs.existsSync(file)) {
      throw new Error('No license signing key: set ARS_LICENSE_JWK or provide secrets/ars-license.json');
    }
    jwk = JSON.parse(fs.readFileSync(file, 'utf8')).jwk;
  }
  return crypto.createPrivateKey({ key: jwk, format: 'jwk' });
}

let privateKey: crypto.KeyObject | null = null;

export interface IssueOpts { plan?: string; features?: string; expires?: string; }
export interface IssuedLicense { key: string; plan: string; features: string; expires: string; serial: string; }

export function issueLicense({ plan = 'pro', features = '*', expires = 'never' }: IssueOpts = {}): IssuedLicense {
  if (!privateKey) privateKey = loadPrivateKey();

  let exp = '0';
  if (expires && expires !== 'never') {
    const d = new Date(expires);
    if (!isNaN(d.getTime())) exp = d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  const serial = crypto.randomBytes(4).toString('hex').slice(0, 6);
  const payload = Buffer.from(`v1|${plan}|${exp}|${features}|${serial}`);
  const sig = crypto.sign(null, payload, privateKey); // Ed25519 → 64 raw bytes
  const blob = Buffer.concat([payload, Buffer.from([0x1f]), sig]);
  const key = (b32enc(blob).match(/.{1,5}/g) || []).join('-');
  return { key, plan, features, expires: exp === '0' ? 'never' : expires, serial };
}
