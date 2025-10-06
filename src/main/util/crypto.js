// src/main/util/crypto.js
const crypto = require('crypto');

const algo = 'aes-256-gcm';
// ⚠️ For a real app, derive this from OS keychain or a per-install random secret.
// For now we persist a per-install key in settings.
function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plaintext, secret) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(blob, secret) {
  const key = deriveKey(secret);
  const raw = Buffer.from(blob, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encrypt, decrypt };
