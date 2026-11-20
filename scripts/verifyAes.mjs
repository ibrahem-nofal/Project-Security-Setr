/**
 * Verification suite for the pure AES engine.
 * Run with: npm run test:crypto
 */
import assert from 'node:assert/strict';
import {
  decryptBlockBytes,
  decryptImage,
  decryptImageFromPixels,
  encryptBlockBytes,
  encryptImage,
  ctrCryptBytes,
} from '../src/lib/aesEngine.js';

const hex = (value) => Uint8Array.from(Buffer.from(value.replace(/\s+/g, ''), 'hex'));
const toHex = (bytes) => Buffer.from(bytes).toString('hex');

// FIPS-197 Appendix C test vectors -----------------------------------------
const fipsPlain = hex('00112233445566778899aabbccddeeff');

const aes128Key = hex('000102030405060708090a0b0c0d0e0f');
assert.equal(toHex(encryptBlockBytes(fipsPlain, aes128Key)), '69c4e0d86a7b0430d8cdb78070b4c55a');
assert.equal(toHex(decryptBlockBytes(hex('69c4e0d86a7b0430d8cdb78070b4c55a'), aes128Key)), toHex(fipsPlain));

const aes256Key = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
assert.equal(toHex(encryptBlockBytes(fipsPlain, aes256Key)), '8ea2b7ca516745bfeafc49904b496089');
assert.equal(toHex(decryptBlockBytes(hex('8ea2b7ca516745bfeafc49904b496089'), aes256Key)), toHex(fipsPlain));

// NIST SP 800-38A CTR-AES128 vector ---------------------------------------
const ctrKey = hex('2b7e151628aed2a6abf7158809cf4f3c');
const ctrIv = hex('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
const ctrPlain = hex(
  '6bc1bee22e409f96e93d7e117393172a' +
    'ae2d8a571e03ac9c9eb76fac45af8e51' +
    '30c81c46a35ce411e5fbc1191a0a52ef' +
    'f69f2445df4f9b17ad2b417be66c3710',
);
assert.equal(
  toHex(ctrCryptBytes(ctrPlain, ctrKey, ctrIv)),
  '874d6191b620e3261bef6864990db6ce' +
    '9806f66b7970fdff8617187bb9fffdff' +
    '5ae4df3edbd5d35e5b4f09020db03eab' +
    '1e031dda2fbe03d1792170a0f3009cee',
);
assert.equal(toHex(ctrCryptBytes(ctrCryptBytes(ctrPlain, ctrKey, ctrIv), ctrKey, ctrIv)), toHex(ctrPlain));

// Image round-trip across modes, key sizes, and an unaligned RGB length ----
for (const keyBits of [128, 256]) {
  const key = new Uint8Array(keyBits / 8);
  for (let i = 0; i < key.length; i += 1) key[i] = (i * 37 + keyBits) & 0xff;
  const iv = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) iv[i] = (i * 11 + keyBits) & 0xff;

  const width = 53;
  const height = 37;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < rgb.length; i += 1) rgb[i] = (i * 13 + 7) & 0xff;

  for (const mode of ['ECB', 'CBC', 'CTR']) {
    const cipher = encryptImage({ rgb, width, height, mode, key, iv });
    const result = decryptImage({ cipher, mode, key, iv });
    assert.equal(result.width, width, `${mode}-${keyBits} width`);
    assert.equal(result.height, height, `${mode}-${keyBits} height`);
    assert.equal(result.mode, mode);
    assert.equal(result.keyBits, keyBits);
    assert.deepEqual(Buffer.from(result.rgb), Buffer.from(rgb), `${mode}-${keyBits} round-trip`);

    const wrongKey = new Uint8Array(key);
    wrongKey[0] ^= 0x01;
    assert.throws(
      () => decryptImage({ cipher, mode, key: wrongKey, iv }),
      (error) => error.code === 'AUTH_FAILED' || error.code === 'PADDING_INVALID',
      `${mode}-${keyBits} must reject a wrong key`,
    );
  }
}

// Encrypted-PNG pixel path: ciphertext + zero-filled canvas tail must
// decrypt without knowing the exact ciphertext length in advance.
for (const mode of ['ECB', 'CBC', 'CTR']) {
  const keyBytes = new Uint8Array(32).fill(9);
  const ivBytes = new Uint8Array(16).fill(4);
  const width = 31;
  const height = 19;
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 29 + 3) & 0xff;

  const encrypted = encryptImage({
    rgb: pixels,
    width,
    height,
    mode,
    key: keyBytes,
    iv: ivBytes,
  });
  const canvasBytes = new Uint8Array(encrypted.length + 13);
  canvasBytes.set(encrypted);

  const restored = decryptImageFromPixels({
    pixels: canvasBytes,
    mode,
    key: keyBytes,
    iv: ivBytes,
  });
  assert.equal(restored.width, width, `${mode} pixel width`);
  assert.equal(restored.height, height, `${mode} pixel height`);
  assert.equal(restored.cipherLength, encrypted.length, `${mode} exact cipher length`);
  assert.deepEqual(Buffer.from(restored.rgb), Buffer.from(pixels), `${mode} pixel round-trip`);
}

// Tamper detection ---------------------------------------------------------
const key = new Uint8Array(32).fill(7);
const iv = new Uint8Array(16).fill(3);
const rgb = new Uint8Array(12 * 9 * 3).fill(128);
const cipher = encryptImage({ rgb, width: 12, height: 9, mode: 'CBC', key, iv });
const tampered = cipher.slice();
tampered[tampered.length - 20] ^= 0xff;
assert.throws(() => decryptImage({ cipher: tampered, mode: 'CBC', key, iv }));

// AES-ECB must preserve repeated plaintext blocks (pattern retention) ------
const repeated = new Uint8Array(96);
for (let i = 0; i < 96; i += 1) repeated[i] = i % 16 < 4 ? 0xaa : i % 16 < 8 ? 0xbb : i % 16 < 12 ? 0xcc : 0xdd;
const ecbOut = encryptImage({ rgb: repeated, width: 8, height: 4, mode: 'ECB', key, iv });
assert.deepEqual(ecbOut.subarray(0, 16), ecbOut.subarray(16, 32), 'ECB must retain equal blocks');

console.log('AES engine verification passed: FIPS-197, NIST CTR, round-trip, auth, pattern retention.');
