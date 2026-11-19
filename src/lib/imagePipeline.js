/**
 * Canvas / raw-pixel pipeline. Images never leave the browser:
 * file → bitmap → opaque RGBA pixels → RGB byte stream → AES worker.
 */
import { MAX_FILE_BYTES, MAX_FILE_MB, MAX_SIDE } from './constants.js';

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function isCipherFile(file) {
  if (!file) return false;
  return file.name.toLowerCase().endsWith('.sitr');
}

export function validateImageFile(file) {
  if (!file) return 'لم يتم اختيار ملف.';
  if (file.size > MAX_FILE_BYTES) {
    return `حجم الملف يتجاوز ${MAX_FILE_MB} م.ب. اختر صورة أصغر.`;
  }
  const extensionOk = /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!ACCEPTED_TYPES.has(file.type) && !extensionOk) {
    return 'الصيغة غير مدعومة. استخدم PNG أو JPG أو WebP.';
  }
  return null;
}

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    image.src = src;
  });
}

export function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  return loadImageElement(url).finally(() => URL.revokeObjectURL(url));
}

/**
 * Draw the source onto a white opaque canvas and downscale it to a
 * performance-safe size. Alpha is flattened so RGB is always meaningful.
 */
export function prepareImage(source) {
  const originalWidth = source.naturalWidth || source.width;
  const originalHeight = source.naturalHeight || source.height;
  if (!originalWidth || !originalHeight) throw new Error('IMAGE_DECODE_FAILED');

  const scale = Math.min(1, MAX_SIDE / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  return {
    imageData,
    rgb: imageDataToRgb(imageData),
    width,
    height,
    originalWidth,
    originalHeight,
    scaled: width !== originalWidth || height !== originalHeight,
  };
}

export function imageDataToRgb(imageData) {
  const source = imageData.data;
  const pixels = imageData.width * imageData.height;
  const rgb = new Uint8Array(pixels * 3);
  let target = 0;
  for (let i = 0; i < source.length; i += 4) {
    rgb[target] = source[i];
    rgb[target + 1] = source[i + 1];
    rgb[target + 2] = source[i + 2];
    target += 3;
  }
  return rgb;
}

/**
 * Map ciphertext bytes into the RGB channels of an opaque image, keeping
 * one byte per channel so the visual pattern (ECB) is preserved.
 */
export function bytesToImageData(bytes, width, height) {
  const pixels = width * height;
  const data = new Uint8ClampedArray(pixels * 4);
  const limit = Math.min(bytes.length, pixels * 3);
  for (let i = 0, target = 0; target < limit; i += 4, target += 3) {
    data[i] = bytes[target];
    data[i + 1] = bytes[target + 1];
    data[i + 2] = bytes[target + 2];
    data[i + 3] = 255;
  }
  for (let i = limit; i < pixels * 3; i += 1) {
    const target = Math.floor(i / 3) * 4 + (i % 3);
    data[target] = 0;
  }
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255;
  }
  return new ImageData(data, width, height);
}

export function computeEntropy(bytes) {
  if (!bytes || bytes.length === 0) return 0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i += 1) {
    counts[bytes[i]] += 1;
  }
  const total = bytes.length;
  let entropy = 0;
  for (let i = 0; i < 256; i += 1) {
    if (counts[i] === 0) continue;
    const probability = counts[i] / total;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export function imageDataToCanvas(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('EXPORT_FAILED'));
    }, 'image/png');
  });
}

export function blockCount(byteLength) {
  return Math.ceil(byteLength / 16);
}
