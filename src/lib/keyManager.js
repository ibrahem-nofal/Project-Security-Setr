/**
 * Browser-side key management: CSPRNG keys, IV/nonce generation and
 * PBKDF2-SHA256 passphrase derivation. All operations are local.
 */
import { bytesToHex, randomHex } from './encoding.js';
import { PASSPHRASE_SALT, PBKDF2_ITERATIONS } from './constants.js';

export function generateKeyHex(keyBits) {
  return randomHex(keyBits / 8);
}

export function generateIvHex() {
  return randomHex(16);
}

export async function deriveKeyFromPassphrase(passphrase, keyBits = 256) {
  const normalized = String(passphrase ?? '');
  if (normalized.trim().length < 4) {
    throw new Error('PASSPHRASE_TOO_SHORT');
  }
  if (keyBits !== 128 && keyBits !== 256) {
    throw new Error('INVALID_KEY_LENGTH');
  }

  const encoder = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(PASSPHRASE_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    keyBits,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function keyFingerprint(hexKey) {
  if (!globalThis.crypto?.subtle) return '';
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(hexKey),
  );
  return bytesToHex(new Uint8Array(digest).subarray(0, 3));
}
