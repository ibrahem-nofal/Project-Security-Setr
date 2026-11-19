import { useCallback, useEffect, useRef } from 'react';

/**
 * Single-worker client for AES jobs. The worker is lazily created on mount
 * and terminated on unmount; typed arrays are copied before transfer so React
 * state (the stored ciphertext) is never detached.
 */
export function useAesWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const sequenceRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/aes.worker.js', import.meta.url), {
      type: 'module',
      name: 'sitr-aes',
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { id, type, value, result, message, code } = event.data || {};
      const job = pendingRef.current.get(id);
      if (!job) return;

      if (type === 'progress') {
        job.onProgress?.(Math.max(0, Math.min(1, value)));
        return;
      }

      pendingRef.current.delete(id);
      if (type === 'done') {
        job.resolve(result);
      } else {
        const error = new Error(message || 'UNKNOWN_ERROR');
        error.code = code || 'UNKNOWN_ERROR';
        job.reject(error);
      }
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || 'WORKER_CRASHED');
      error.code = 'WORKER_CRASHED';
      workerRef.current = null;
      for (const job of pendingRef.current.values()) job.reject(error);
      pendingRef.current.clear();
    };

    worker.onmessageerror = () => {
      const error = new Error('WORKER_MESSAGE_ERROR');
      error.code = 'WORKER_MESSAGE_ERROR';
      for (const job of pendingRef.current.values()) job.reject(error);
      pendingRef.current.clear();
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      const error = new Error('WORKER_TERMINATED');
      error.code = 'WORKER_TERMINATED';
      for (const job of pendingRef.current.values()) job.reject(error);
      pendingRef.current.clear();
    };
  }, []);

  const run = useCallback((action, payload, onProgress) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('WORKER_UNAVAILABLE'));

    const id = (sequenceRef.current += 1);
    let message;
    let transfer;

    if (action === 'encrypt') {
      const rgb = payload.rgb.slice();
      const key = payload.key.slice();
      const iv = payload.iv ? payload.iv.slice() : undefined;
      message = {
        id,
        action,
        payload: { ...payload, rgb, key, iv },
      };
      transfer = [rgb.buffer];
    } else {
      const cipher = payload.cipher.slice();
      const key = payload.key.slice();
      const iv = payload.iv ? payload.iv.slice() : undefined;
      message = {
        id,
        action,
        payload: { ...payload, cipher, key, iv },
      };
      transfer = [cipher.buffer];
    }

    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject, onProgress });
      try {
        worker.postMessage(message, transfer);
      } catch (error) {
        pendingRef.current.delete(id);
        reject(error);
      }
    });
  }, []);

  return { run };
}
