/**
 * .sitr binary container — lets learners export an encrypted image plus the
 * public metadata (mode, IV, dimensions) needed to decrypt it later.
 */
import { AES_BLOCK_BYTES, MODE_CODES, MODE_FROM_CODE, PAYLOAD_HEADER_SIZE } from './constants.js';
import { bytesToHex } from './encoding.js';

const MAGIC = [0x53, 0x49, 0x54, 0x52]; // "SITR"
const VERSION = 1;
const HEADER_SIZE = 38;
const MAX_NAME_BYTES = 240;
export const CIPHER_FILE_EXTENSION = 'sitr';
export const MAX_CIPHER_FILE_BYTES = 80 * 1024 * 1024;

function modeCode(mode) {
  if (!Object.prototype.hasOwnProperty.call(MODE_CODES, mode)) {
    throw new Error('INVALID_MODE');
  }
  return MODE_CODES[mode];
}

function writeUint32(view, offset, value) {
  view[offset] = (value >>> 24) & 0xff;
  view[offset + 1] = (value >>> 16) & 0xff;
  view[offset + 2] = (value >>> 8) & 0xff;
  view[offset + 3] = value & 0xff;
}

function readUint32(view, offset) {
  return (
    ((view[offset] << 24) | (view[offset + 1] << 16) | (view[offset + 2] << 8) | view[offset + 3]) >>>
    0
  );
}

export function createCipherFile({ cipher, width, height, mode, keyBits, iv, sourceName }) {
  if (!(cipher instanceof Uint8Array) || cipher.length === 0) throw new Error('INVALID_PAYLOAD');
  const encoder = new TextEncoder();
  let nameBytes = encoder.encode(String(sourceName || 'image').slice(0, 80));
  if (nameBytes.length > MAX_NAME_BYTES) nameBytes = nameBytes.subarray(0, MAX_NAME_BYTES);

  const bytes = new Uint8Array(HEADER_SIZE + nameBytes.length + cipher.length);
  bytes.set(MAGIC, 0);
  bytes[4] = VERSION;
  bytes[5] = modeCode(mode);
  bytes[6] = keyBits === 256 ? 1 : 0;
  bytes[7] = 0;
  writeUint32(bytes, 8, width);
  writeUint32(bytes, 12, height);
  bytes.set(iv, 16);
  bytes[32] = (nameBytes.length >>> 8) & 0xff;
  bytes[33] = nameBytes.length & 0xff;
  writeUint32(bytes, 34, cipher.length);
  bytes.set(nameBytes, HEADER_SIZE);
  bytes.set(cipher, HEADER_SIZE + nameBytes.length);

  return {
    bytes,
    blob: new Blob([bytes], { type: 'application/octet-stream' }),
    ivHex: bytesToHex(iv),
    sourceName,
  };
}

export function parseCipherFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < HEADER_SIZE) throw new Error('FILE_TRUNCATED');
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) throw new Error('FILE_INVALID');
  }
  if (bytes[4] !== VERSION) throw new Error('FILE_VERSION');
  const mode = MODE_FROM_CODE[bytes[5]];
  if (!mode) throw new Error('FILE_INVALID');
  const keyBits = bytes[6] === 1 ? 256 : 128;
  const width = readUint32(bytes, 8);
  const height = readUint32(bytes, 12);
  if (!width || !height || width > 20000 || height > 20000) throw new Error('FILE_INVALID');

  const iv = bytes.slice(16, 32);
  const nameLength = (bytes[32] << 8) | bytes[33];
  const dataLength = readUint32(bytes, 34);
  if (nameLength > MAX_NAME_BYTES) throw new Error('FILE_INVALID');
  if (dataLength === 0 || HEADER_SIZE + nameLength + dataLength !== bytes.length) {
    throw new Error('FILE_TRUNCATED');
  }

  // Keep declared dimensions honest so a corrupted package cannot trigger a
  // huge canvas allocation before authentication is attempted.
  const rgbLength = width * height * 3;
  if (mode === 'CTR') {
    if (dataLength !== PAYLOAD_HEADER_SIZE + rgbLength) throw new Error('FILE_INVALID');
  } else {
    const paddingOverhead = dataLength - rgbLength;
    if (
      dataLength % AES_BLOCK_BYTES !== 0 ||
      paddingOverhead < PAYLOAD_HEADER_SIZE + 1 ||
      paddingOverhead > PAYLOAD_HEADER_SIZE + AES_BLOCK_BYTES
    ) {
      throw new Error('FILE_INVALID');
    }
  }

  const name = new TextDecoder().decode(bytes.subarray(HEADER_SIZE, HEADER_SIZE + nameLength));
  const cipher = bytes.slice(HEADER_SIZE + nameLength);
  return { cipher, width, height, mode, keyBits, iv, ivHex: bytesToHex(iv), sourceName: name || 'image' };
}
