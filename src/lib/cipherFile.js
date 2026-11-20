/**
 * .sitr binary container — v1
 *
 *   [4 bytes  Magic  'SITR']
 *   [1 byte   Version      0x01]
 *   [1 byte   Mode         0=ECB, 1=CBC, 2=CTR]
 *   [16 bytes IV]
 *   [Payload ciphertext …]
 *
 * The payload is exactly what the AES engine produced: `RGB || 24-byte
 * payload header` (+ PKCS#7 padding for ECB/CBC). Dimensions and key size
 * live inside that encrypted payload, so the container never needs to trust
 * unauthenticated metadata. The IV is public by definition.
 */
import { AES_BLOCK_BYTES, MODE_CODES, MODE_FROM_CODE, PAYLOAD_HEADER_SIZE } from './constants.js';
import { bytesToHex } from './encoding.js';

const MAGIC = [0x53, 0x49, 0x54, 0x52]; // "SITR"
const VERSION = 1;
export const CIPHER_FILE_HEADER_SIZE = 22;
export const CIPHER_FILE_EXTENSION = 'sitr';
export const MAX_CIPHER_FILE_BYTES = 80 * 1024 * 1024;

function modeCode(mode) {
  if (!Object.prototype.hasOwnProperty.call(MODE_CODES, mode)) {
    throw new Error('INVALID_MODE');
  }
  return MODE_CODES[mode];
}

export function createCipherFile({ cipher, mode, iv }) {
  if (!(cipher instanceof Uint8Array) || cipher.length === 0) {
    throw new Error('INVALID_PAYLOAD');
  }
  if (!(iv instanceof Uint8Array) || iv.length !== AES_BLOCK_BYTES) {
    throw new Error('INVALID_IV');
  }

  const bytes = new Uint8Array(CIPHER_FILE_HEADER_SIZE + cipher.length);
  bytes.set(MAGIC, 0);
  bytes[4] = VERSION;
  bytes[5] = modeCode(mode);
  bytes.set(iv, 6);
  bytes.set(cipher, CIPHER_FILE_HEADER_SIZE);

  return {
    bytes,
    blob: new Blob([bytes], { type: 'application/octet-stream' }),
    ivHex: bytesToHex(iv),
  };
}

export function parseCipherFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length <= CIPHER_FILE_HEADER_SIZE) throw new Error('FILE_TRUNCATED');

  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) throw new Error('FILE_INVALID');
  }
  if (bytes[4] !== VERSION) throw new Error('FILE_VERSION');

  const mode = MODE_FROM_CODE[bytes[5]];
  if (!mode) throw new Error('FILE_INVALID');

  const iv = bytes.slice(6, 22);
  const cipher = bytes.slice(CIPHER_FILE_HEADER_SIZE);
  const minimumCipherLength = Math.ceil((PAYLOAD_HEADER_SIZE + 1) / AES_BLOCK_BYTES) * AES_BLOCK_BYTES;

  if (mode === 'CTR') {
    if (cipher.length < PAYLOAD_HEADER_SIZE + 1) throw new Error('FILE_TRUNCATED');
  } else if (cipher.length % AES_BLOCK_BYTES !== 0 || cipher.length < minimumCipherLength) {
    throw new Error('FILE_INVALID');
  }

  return {
    cipher,
    mode,
    iv,
    ivHex: bytesToHex(iv),
    // Key size is authenticated inside the encrypted payload header; it is
    // resolved after the user supplies a key.
    keyBits: null,
    sourceName: '',
  };
}
