/**
 * سِتر — Pure client-side AES engine.
 *
 * Implements FIPS-197 AES-128 / AES-256 block operations and the three
 * educational cipher modes used by the lab:
 *
 *   • ECB  — Electronic Codebook (independent blocks, padding required)
 *   • CBC  — Cipher Block Chaining (16-byte IV, padding required)
 *   • CTR  — Counter mode (stream cipher, no padding)
 *
 * Image payload layout (before padding):
 *
 *   [ RGB pixels … ][ 24-byte metadata header ]
 *
 * The header is appended after the pixels so that the first ciphertext
 * bytes map 1:1 to the encrypted RGB channels (used for canvas display).
 * A valid header also acts as an authentication check when decrypting:
 * a wrong key produces random header bytes and is rejected.
 *
 * No network, no WebCrypto — every byte is processed locally.
 */

import {
  AES_BLOCK_BYTES,
  MODE_CODES,
  MODE_FROM_CODE,
  PAYLOAD_HEADER_SIZE,
} from './constants.js';

export const AES_BLOCK_SIZE = AES_BLOCK_BYTES;
export const HEADER_SIZE = PAYLOAD_HEADER_SIZE;
export const MAGIC = Object.freeze([0x53, 0x49, 0x54, 0x52, 0x49, 0x4d, 0x47]); // "SITRIMG"
const FORMAT_VERSION = 1;

const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

const INV_SBOX = new Uint8Array([
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
]);

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function buildMulTable(factor) {
  const table = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    let a = value;
    let b = factor;
    let result = 0;
    while (b > 0) {
      if (b & 1) result ^= a;
      a = a & 0x80 ? ((a << 1) ^ 0x1b) & 0xff : (a << 1) & 0xff;
      b >>= 1;
    }
    table[value] = result;
  }
  return table;
}

const MUL9 = buildMulTable(9);
const MUL11 = buildMulTable(11);
const MUL13 = buildMulTable(13);
const MUL14 = buildMulTable(14);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function xtime(value) {
  return value & 0x80 ? ((value << 1) ^ 0x1b) & 0xff : (value << 1) & 0xff;
}

/* ------------------------------------------------------------------ */
/* Key schedule                                                        */
/* ------------------------------------------------------------------ */

export function expandKey(key) {
  if (!(key instanceof Uint8Array) || (key.length !== 16 && key.length !== 32)) {
    fail('INVALID_KEY_LENGTH');
  }

  const nk = key.length / 4;
  const rounds = nk + 6;
  const words = new Uint8Array(16 * (rounds + 1));
  words.set(key);

  let generated = key.length;
  let rconIndex = 0;
  const temp = new Uint8Array(4);

  while (generated < words.length) {
    temp.set(words.subarray(generated - 4, generated));

    if (generated % key.length === 0) {
      const first = temp[0];
      temp[0] = SBOX[temp[1]];
      temp[1] = SBOX[temp[2]];
      temp[2] = SBOX[temp[3]];
      temp[3] = SBOX[first];
      temp[0] ^= RCON[rconIndex];
      rconIndex += 1;
    } else if (nk > 6 && generated % key.length === 16) {
      temp[0] = SBOX[temp[0]];
      temp[1] = SBOX[temp[1]];
      temp[2] = SBOX[temp[2]];
      temp[3] = SBOX[temp[3]];
    }

    for (let i = 0; i < 4; i += 1) {
      words[generated] = words[generated - key.length] ^ temp[i];
      generated += 1;
    }
  }

  return { roundKeys: words, rounds };
}

/* ------------------------------------------------------------------ */
/* Block primitives                                                    */
/* ------------------------------------------------------------------ */

function addRoundKey(state, roundKeys, offset) {
  for (let i = 0; i < 16; i += 1) {
    state[i] ^= roundKeys[offset + i];
  }
}

function subBytes(state) {
  for (let i = 0; i < 16; i += 1) {
    state[i] = SBOX[state[i]];
  }
}

function invSubBytes(state) {
  for (let i = 0; i < 16; i += 1) {
    state[i] = INV_SBOX[state[i]];
  }
}

function shiftRows(state) {
  let temp = state[1];
  state[1] = state[5];
  state[5] = state[9];
  state[9] = state[13];
  state[13] = temp;

  temp = state[2];
  state[2] = state[10];
  state[10] = temp;
  temp = state[6];
  state[6] = state[14];
  state[14] = temp;

  temp = state[15];
  state[15] = state[11];
  state[11] = state[7];
  state[7] = state[3];
  state[3] = temp;
}

function invShiftRows(state) {
  let temp = state[13];
  state[13] = state[9];
  state[9] = state[5];
  state[5] = state[1];
  state[1] = temp;

  temp = state[2];
  state[2] = state[10];
  state[10] = temp;
  temp = state[6];
  state[6] = state[14];
  state[14] = temp;

  temp = state[3];
  state[3] = state[7];
  state[7] = state[11];
  state[11] = state[15];
  state[15] = temp;
}

function mixColumns(state) {
  for (let c = 0; c < 16; c += 4) {
    const a0 = state[c];
    const a1 = state[c + 1];
    const a2 = state[c + 2];
    const a3 = state[c + 3];
    const all = a0 ^ a1 ^ a2 ^ a3;

    state[c] = a0 ^ all ^ xtime(a0 ^ a1);
    state[c + 1] = a1 ^ all ^ xtime(a1 ^ a2);
    state[c + 2] = a2 ^ all ^ xtime(a2 ^ a3);
    state[c + 3] = a3 ^ all ^ xtime(a3 ^ a0);
  }
}

function invMixColumns(state) {
  for (let c = 0; c < 16; c += 4) {
    const a0 = state[c];
    const a1 = state[c + 1];
    const a2 = state[c + 2];
    const a3 = state[c + 3];

    state[c] = MUL14[a0] ^ MUL11[a1] ^ MUL13[a2] ^ MUL9[a3];
    state[c + 1] = MUL9[a0] ^ MUL14[a1] ^ MUL11[a2] ^ MUL13[a3];
    state[c + 2] = MUL13[a0] ^ MUL9[a1] ^ MUL14[a2] ^ MUL11[a3];
    state[c + 3] = MUL11[a0] ^ MUL13[a1] ^ MUL9[a2] ^ MUL14[a3];
  }
}

export function encryptBlock(input, output, inOffset, outOffset, schedule, scratch) {
  const state = scratch ?? new Uint8Array(16);
  state.set(input.subarray(inOffset, inOffset + 16));
  addRoundKey(state, schedule.roundKeys, 0);

  for (let round = 1; round < schedule.rounds; round += 1) {
    subBytes(state);
    shiftRows(state);
    mixColumns(state);
    addRoundKey(state, schedule.roundKeys, round * 16);
  }

  subBytes(state);
  shiftRows(state);
  addRoundKey(state, schedule.roundKeys, schedule.rounds * 16);
  output.set(state, outOffset);
}

export function decryptBlock(input, output, inOffset, outOffset, schedule, scratch) {
  const state = scratch ?? new Uint8Array(16);
  state.set(input.subarray(inOffset, inOffset + 16));
  addRoundKey(state, schedule.roundKeys, schedule.rounds * 16);

  for (let round = schedule.rounds - 1; round >= 1; round -= 1) {
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, schedule.roundKeys, round * 16);
    invMixColumns(state);
  }

  invShiftRows(state);
  invSubBytes(state);
  addRoundKey(state, schedule.roundKeys, 0);
  output.set(state, outOffset);
}

// Single-block convenience API (used by the test-vector suite).
export function encryptBlockBytes(input, key) {
  if (!(input instanceof Uint8Array) || input.length !== 16) fail('INVALID_BLOCK');
  const output = new Uint8Array(16);
  encryptBlock(input, output, 0, 0, expandKey(key));
  return output;
}

export function decryptBlockBytes(input, key) {
  if (!(input instanceof Uint8Array) || input.length !== 16) fail('INVALID_BLOCK');
  const output = new Uint8Array(16);
  decryptBlock(input, output, 0, 0, expandKey(key));
  return output;
}

/* ------------------------------------------------------------------ */
/* Padding                                                             */
/* ------------------------------------------------------------------ */

function padPkcs7(bytes) {
  const padLength = AES_BLOCK_SIZE - (bytes.length % AES_BLOCK_SIZE);
  const padded = new Uint8Array(bytes.length + padLength);
  padded.set(bytes);
  padded.fill(padLength, bytes.length);
  return padded;
}

function unpadPkcs7(bytes) {
  if (bytes.length === 0 || bytes.length % AES_BLOCK_SIZE !== 0) fail('PADDING_INVALID');
  const padLength = bytes[bytes.length - 1];
  if (padLength < 1 || padLength > AES_BLOCK_SIZE || padLength > bytes.length) {
    fail('PADDING_INVALID');
  }
  for (let i = bytes.length - padLength; i < bytes.length; i += 1) {
    if (bytes[i] !== padLength) fail('PADDING_INVALID');
  }
  return bytes.subarray(0, bytes.length - padLength);
}

/* ------------------------------------------------------------------ */
/* Mode drivers                                                        */
/* ------------------------------------------------------------------ */

function reportProgressFactory(total, onProgress) {
  const step = Math.max(1, Math.floor(total / 60));
  return (index) => {
    if (index % step === 0 || index === total - 1) {
      onProgress((index + 1) / total);
    }
  };
}

function ctrXor(input, output, iv, schedule, onProgress) {
  const counter = new Uint8Array(16);
  counter.set(iv);
  const stream = new Uint8Array(16);
  const scratch = new Uint8Array(16);
  const totalBlocks = Math.ceil(input.length / 16);
  const report = reportProgressFactory(totalBlocks, onProgress);

  for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex += 1) {
    encryptBlock(counter, stream, 0, 0, schedule, scratch);
    const start = blockIndex * 16;
    const end = Math.min(start + 16, input.length);
    for (let i = start; i < end; i += 1) {
      output[i] = input[i] ^ stream[i - start];
    }
    for (let i = 15; i >= 0; i -= 1) {
      counter[i] = (counter[i] + 1) & 0xff;
      if (counter[i] !== 0) break;
    }
    report(blockIndex);
  }
}

function encryptEcb(input, output, schedule, onProgress) {
  const totalBlocks = input.length / 16;
  const scratch = new Uint8Array(16);
  const report = reportProgressFactory(totalBlocks, onProgress);
  for (let i = 0; i < totalBlocks; i += 1) {
    encryptBlock(input, output, i * 16, i * 16, schedule, scratch);
    report(i);
  }
}

function decryptEcb(input, output, schedule, onProgress) {
  const totalBlocks = input.length / 16;
  const scratch = new Uint8Array(16);
  const report = reportProgressFactory(totalBlocks, onProgress);
  for (let i = 0; i < totalBlocks; i += 1) {
    decryptBlock(input, output, i * 16, i * 16, schedule, scratch);
    report(i);
  }
}

function encryptCbc(input, output, iv, schedule, onProgress) {
  const totalBlocks = input.length / 16;
  const scratch = new Uint8Array(16);
  const block = new Uint8Array(16);
  const previous = new Uint8Array(16);
  previous.set(iv);
  const report = reportProgressFactory(totalBlocks, onProgress);

  for (let i = 0; i < totalBlocks; i += 1) {
    const offset = i * 16;
    for (let j = 0; j < 16; j += 1) {
      block[j] = input[offset + j] ^ previous[j];
    }
    encryptBlock(block, output, 0, offset, schedule, scratch);
    previous.set(output.subarray(offset, offset + 16));
    report(i);
  }
}

function decryptCbc(input, output, iv, schedule, onProgress) {
  const totalBlocks = input.length / 16;
  const scratch = new Uint8Array(16);
  const previous = new Uint8Array(16);
  previous.set(iv);
  const report = reportProgressFactory(totalBlocks, onProgress);

  for (let i = 0; i < totalBlocks; i += 1) {
    const offset = i * 16;
    const nextPrevious = input.subarray(offset, offset + 16);
    decryptBlock(input, output, offset, offset, schedule, scratch);
    for (let j = 0; j < 16; j += 1) {
      output[offset + j] ^= previous[j];
    }
    previous.set(nextPrevious);
    report(i);
  }
}

/* ------------------------------------------------------------------ */
/* Image metadata header                                               */
/* ------------------------------------------------------------------ */

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function readUint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

function buildHeader(mode, keyBits, width, height, rgbLength) {
  const header = new Uint8Array(HEADER_SIZE);
  header.set(MAGIC, 0);
  header[7] = FORMAT_VERSION;
  header[8] = MODE_CODES[mode];
  header[9] = keyBits === 256 ? 1 : 0;
  header[10] = 0;
  header[11] = 0;
  writeUint32(header, 12, width);
  writeUint32(header, 16, height);
  writeUint32(header, 20, rgbLength);
  return header;
}

function parseHeader(bytes) {
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) fail('AUTH_FAILED');
  }
  if (bytes[7] !== FORMAT_VERSION) fail('INVALID_FORMAT');

  const mode = MODE_FROM_CODE[bytes[8]];
  if (!mode) fail('INVALID_FORMAT');

  const keyBits = bytes[9] === 1 ? 256 : 128;
  const width = readUint32(bytes, 12);
  const height = readUint32(bytes, 16);
  const rgbLength = readUint32(bytes, 20);

  if (width < 1 || height < 1 || width > 20000 || height > 20000) fail('INVALID_FORMAT');
  if (rgbLength !== width * height * 3) fail('INVALID_FORMAT');
  return { mode, keyBits, width, height, rgbLength };
}

function validateCommon({ mode, key, iv }) {
  if (!MODE_CODES.hasOwnProperty(mode)) fail('INVALID_MODE');
  if (!(key instanceof Uint8Array) || (key.length !== 16 && key.length !== 32)) {
    fail('INVALID_KEY_LENGTH');
  }
  if ((mode === 'CBC' || mode === 'CTR') && (!(iv instanceof Uint8Array) || iv.length !== 16)) {
    fail('INVALID_IV');
  }
}

/* ------------------------------------------------------------------ */
/* Public image API                                                    */
/* ------------------------------------------------------------------ */

/**
 * Encrypt raw RGB bytes.
 * @returns {Uint8Array} ciphertext (length includes header + padding)
 */
export function encryptImage({ rgb, width, height, mode, key, iv, onProgress = () => {} }) {
  validateCommon({ mode, key, iv });
  if (!(rgb instanceof Uint8Array)) fail('INVALID_PAYLOAD');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    fail('INVALID_DIMENSIONS');
  }
  if (rgb.length !== width * height * 3) fail('INVALID_PAYLOAD');

  const schedule = expandKey(key);
  const header = buildHeader(mode, key.length * 8, width, height, rgb.length);
  const payload = new Uint8Array(rgb.length + HEADER_SIZE);
  payload.set(rgb, 0);
  payload.set(header, rgb.length);

  if (mode === 'CTR') {
    const output = new Uint8Array(payload.length);
    ctrXor(payload, output, iv, schedule, onProgress);
    return output;
  }

  const padded = padPkcs7(payload);
  const output = new Uint8Array(padded.length);
  if (mode === 'ECB') encryptEcb(padded, output, schedule, onProgress);
  else encryptCbc(padded, output, iv, schedule, onProgress);
  return output;
}

/**
 * Decrypt a ciphertext produced by encryptImage().
 * @returns {{rgb: Uint8Array, width: number, height: number, mode: string, keyBits: number}}
 */
export function decryptImage({ cipher, mode, key, iv, onProgress = () => {} }) {
  if (!(cipher instanceof Uint8Array)) fail('INVALID_PAYLOAD');
  validateCommon({ mode, key, iv });
  if (cipher.length < HEADER_SIZE) fail('DATA_TRUNCATED');

  const plain = new Uint8Array(cipher.length);
  if (mode === 'CTR') {
    ctrXor(cipher, plain, iv, expandKey(key), onProgress);
  } else {
    if (cipher.length % 16 !== 0) fail('DATA_TRUNCATED');
    const schedule = expandKey(key);
    if (mode === 'ECB') decryptEcb(cipher, plain, schedule, onProgress);
    else decryptCbc(cipher, plain, iv, schedule, onProgress);
  }

  const unpadded = mode === 'CTR' ? plain : unpadPkcs7(plain);
  if (unpadded.length < HEADER_SIZE) fail('AUTH_FAILED');

  const headerStart = unpadded.length - HEADER_SIZE;
  const header = unpadded.subarray(headerStart);
  const meta = parseHeader(header);

  if (meta.mode !== mode) fail('MODE_MISMATCH');
  if (meta.keyBits !== key.length * 8) fail('KEY_MISMATCH');
  if (headerStart !== meta.rgbLength) fail('DATA_TRUNCATED');

  return {
    rgb: unpadded.slice(0, meta.rgbLength),
    width: meta.width,
    height: meta.height,
    mode: meta.mode,
    keyBits: meta.keyBits,
  };
}

/**
 * Locate the authenticated payload header inside a decrypted byte stream.
 *
 * Encrypted PNGs contain `ciphertext` mapped 1:1 to RGB bytes. The PNG may
 * be slightly larger than the ciphertext (trailing zero padding), so we
 * cannot use "header at the end". Instead we scan for the 8-byte magic and
 * require the header to be fully self-consistent: the header must begin
 * exactly at the declared RGB length, the mode/key size must match, and the
 * PKCS#7 padding that follows the header must be valid.
 */
function locateImageHeader(plain, mode, keyBits) {
  const lastOffset = plain.length - HEADER_SIZE;
  for (let offset = 0; offset <= lastOffset; offset += 1) {
    if (plain[offset] !== MAGIC[0]) continue;
    let magicMatches = true;
    for (let i = 1; i < MAGIC.length; i += 1) {
      if (plain[offset + i] !== MAGIC[i]) {
        magicMatches = false;
        break;
      }
    }
    if (!magicMatches) continue;
    if (plain[offset + MAGIC.length] !== FORMAT_VERSION) continue;

    const headerMode = MODE_FROM_CODE[plain[offset + 8]];
    if (headerMode !== mode) continue;

    const headerBits = plain[offset + 9] === 1 ? 256 : 128;
    if (headerBits !== keyBits) continue;

    const width = readUint32(plain, offset + 12);
    const height = readUint32(plain, offset + 16);
    const rgbLength = readUint32(plain, offset + 20);
    if (width < 1 || height < 1 || width > 20000 || height > 20000) continue;
    if (rgbLength !== width * height * 3) continue;
    if (offset !== rgbLength) continue;

    const payloadLength = rgbLength + HEADER_SIZE;
    let cipherLength;
    if (mode === 'CTR') {
      cipherLength = payloadLength;
      if (cipherLength > plain.length) continue;
    } else {
      cipherLength = Math.ceil(payloadLength / AES_BLOCK_BYTES) * AES_BLOCK_BYTES;
      if (cipherLength > plain.length) continue;
      const remainder = payloadLength % AES_BLOCK_BYTES;
      const padLength = remainder === 0 ? AES_BLOCK_BYTES : AES_BLOCK_BYTES - remainder;
      let paddingValid = true;
      for (let i = 0; i < padLength; i += 1) {
        if (plain[offset + HEADER_SIZE + i] !== padLength) {
          paddingValid = false;
          break;
        }
      }
      if (!paddingValid) continue;
    }

    return { width, height, rgbLength, cipherLength };
  }
  return null;
}

/**
 * Decrypt ciphertext that was stored as opaque RGB pixels (encrypted PNG).
 *
 * Unlike decryptImage(), the header is not necessarily at the end of the
 * buffer: the canvas may have appended zero bytes to fill its last row.
 * The returned `cipherLength` is the exact ciphertext length, so callers
 * can trim the pixel buffer before exporting a `.sitr` package.
 */
export function decryptImageFromPixels({ pixels, mode, key, iv, onProgress = () => {} }) {
  if (!(pixels instanceof Uint8Array)) fail('INVALID_PAYLOAD');
  validateCommon({ mode, key, iv });

  const schedule = expandKey(key);
  let input = pixels;

  if (mode === 'CTR') {
    if (pixels.length < HEADER_SIZE) fail('DATA_TRUNCATED');
  } else {
    const usable = pixels.length - (pixels.length % AES_BLOCK_BYTES);
    if (usable < HEADER_SIZE + AES_BLOCK_BYTES) fail('DATA_TRUNCATED');
    input = pixels.subarray(0, usable);
  }

  const plain = new Uint8Array(input.length);
  if (mode === 'CTR') ctrXor(input, plain, iv, schedule, onProgress);
  else if (mode === 'ECB') decryptEcb(input, plain, schedule, onProgress);
  else decryptCbc(input, plain, iv, schedule, onProgress);

  const meta = locateImageHeader(plain, mode, key.length * 8);
  if (!meta) fail('AUTH_FAILED');

  return {
    rgb: plain.slice(0, meta.rgbLength),
    width: meta.width,
    height: meta.height,
    mode,
    keyBits: key.length * 8,
    cipherLength: meta.cipherLength,
  };
}

/** Raw CTR keystream helper (used by the verification suite). */
export function ctrCryptBytes(input, key, iv) {
  const output = new Uint8Array(input.length);
  ctrXor(input, output, iv, expandKey(key), () => {});
  return output;
}
