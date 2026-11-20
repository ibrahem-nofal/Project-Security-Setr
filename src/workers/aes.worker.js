/**
 * AES worker — keeps the main thread responsive while processing millions
 * of pixel bytes. Receives typed arrays, returns transferred typed arrays.
 */
import { decryptImage, decryptImageFromPixels, encryptImage } from '../lib/aesEngine.js';

self.onmessage = (event) => {
  const { id, action, payload } = event.data || {};
  if (!id) return;

  const onProgress = (value) => {
    self.postMessage({ id, type: 'progress', value });
  };

  try {
    if (action === 'encrypt') {
      const cipher = encryptImage({
        rgb: payload.rgb,
        width: payload.width,
        height: payload.height,
        mode: payload.mode,
        key: payload.key,
        iv: payload.iv,
        onProgress,
      });
      self.postMessage(
        { id, type: 'done', result: { cipher, width: payload.width, height: payload.height } },
        [cipher.buffer],
      );
      return;
    }

    if (action === 'decrypt' || action === 'decrypt-pixels') {
      const result =
        action === 'decrypt-pixels'
          ? decryptImageFromPixels({
              pixels: payload.cipher,
              mode: payload.mode,
              key: payload.key,
              iv: payload.iv,
              onProgress,
            })
          : decryptImage({
              cipher: payload.cipher,
              mode: payload.mode,
              key: payload.key,
              iv: payload.iv,
              onProgress,
            });
      self.postMessage(
        {
          id,
          type: 'done',
          result: {
            rgb: result.rgb,
            width: result.width,
            height: result.height,
            mode: result.mode,
            keyBits: result.keyBits,
            cipherLength: result.cipherLength,
          },
        },
        [result.rgb.buffer],
      );
      return;
    }

    throw new Error('UNKNOWN_ACTION');
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      message: error?.message || 'UNKNOWN_ERROR',
      code: error?.code || 'UNKNOWN_ERROR',
    });
  }
};
