import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const hex =
    process.env.BANK_ENCRYPTION_KEY ??
    (process.env.NODE_ENV === 'test' ? 'cd'.repeat(32) : null);
  if (!hex) throw new Error('BANK_ENCRYPTION_KEY not configured');
  return Buffer.from(hex, 'hex');
}

export function encryptBankField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  return `${PREFIX}${combined.toString('base64')}`;
}

export function decryptBankField(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const key = getKey();
  const combined = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = combined.subarray(0, IV_BYTES);
  const tag = combined.subarray(combined.length - TAG_BYTES);
  const ciphertext = combined.subarray(IV_BYTES, combined.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
