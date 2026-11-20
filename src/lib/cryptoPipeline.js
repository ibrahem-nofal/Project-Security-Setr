/**
 * High-level bridge between the canvas pixel world and the AES byte world.
 *
 * Ciphertext is rendered into the RGB channels of a fully opaque canvas so
 * an encrypted PNG survives a browser save/reload without a single byte
 * changing. The payload metadata header is part of the ciphertext, which
 * lets the importer recover the original dimensions and authenticate the
 * key even when the PNG has no side-channel metadata.
 */
import { AES_BLOCK_BYTES, PAYLOAD_HEADER_SIZE } from './constants.js';
import { bytesToImageData } from './imagePipeline.js';

const MAX_PREVIEW_PIXELS = 2_400_000;
const MAX_PREVIEW_WIDTH = 1600;
const MAX_EXPORT_PIXELS = 16_000_000;

export function isPngFile(file) {
  if (!file) return false;
  return file.type === 'image/png' || /\.png$/i.test(file.name || '');
}

/**
 * Choose a canvas size that can hold `byteLength` ciphertext bytes at one
 * byte per RGB channel. Returns `truncated: true` when the preview cap is
 * reached; previews may be truncated, exports may not.
 */
export function cipherDisplaySize(
  byteLength,
  preferredWidth = 0,
  { maxPixels = MAX_PREVIEW_PIXELS, maxWidth = MAX_PREVIEW_WIDTH } = {},
) {
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    return { width: 1, height: 1, capacity: 3, truncated: false };
  }

  let width = preferredWidth > 0
    ? Math.round(preferredWidth)
    : Math.ceil(Math.sqrt(byteLength / 3));
  width = Math.max(1, Math.min(maxWidth, width));

  let height = Math.max(1, Math.ceil(byteLength / (width * 3)));
  const maxHeight = Math.max(1, Math.floor(maxPixels / width));
  let truncated = false;
  if (height > maxHeight) {
    height = maxHeight;
    truncated = true;
  }

  return {
    width,
    height,
    capacity: width * height * 3,
    truncated: truncated || width * height * 3 < byteLength,
  };
}

/** Full, lossless ciphertext image (used for encrypted PNG export). */
export function buildCipherImageDataForExport(bytes, preferredWidth = 0) {
  const size = cipherDisplaySize(bytes.length, preferredWidth, {
    maxPixels: MAX_EXPORT_PIXELS,
    maxWidth: 4000,
  });
  if (size.truncated) return null;
  return {
    imageData: bytesToImageData(bytes, size.width, size.height),
    width: size.width,
    height: size.height,
  };
}

/** Preview image (may be capped for hostile or oversized packages). */
export function buildCipherImageData(bytes, preferredWidth = 0) {
  const size = cipherDisplaySize(bytes.length, preferredWidth);
  return {
    imageData: bytesToImageData(bytes, size.width, size.height),
    width: size.width,
    height: size.height,
    truncated: size.truncated,
  };
}

/**
 * Exact ciphertext length for a payload whose RGB length is known. The
 * payload is `RGB || 24-byte header`; ECB/CBC add PKCS#7 padding, CTR does
 * not.
 */
export function expectedCipherLength(rgbLength, mode) {
  const payloadLength = rgbLength + PAYLOAD_HEADER_SIZE;
  if (mode === 'CTR') return payloadLength;
  return Math.ceil(payloadLength / AES_BLOCK_BYTES) * AES_BLOCK_BYTES;
}
