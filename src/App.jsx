import { useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import Sidebar from './components/Sidebar.jsx';
import CanvasStage from './components/CanvasStage.jsx';
import Footer from './components/Footer.jsx';
import Toast from './components/Toast.jsx';
import { useAesWorker } from './hooks/useAesWorker.js';
import {
  bytesToImageData,
  blockCount,
  canvasToBlob,
  computeEntropy,
  imageDataToCanvas,
  imageDataToRgb,
  isCipherFile,
  loadImageElement,
  loadImageFromFile,
  loadImagePixelsFromFile,
  prepareImage,
  validateImageFile,
} from './lib/imagePipeline.js';
import {
  buildCipherImageData,
  buildCipherImageDataForExport,
  isPngFile,
} from './lib/cryptoPipeline.js';
import {
  copyText,
  downloadBlob,
  hexToBytes,
  isHexOfLength,
  normalizeHex,
  sanitizeFilename,
  bytesToHex,
} from './lib/encoding.js';
import { generateIvHex, generateKeyHex, deriveKeyFromPassphrase } from './lib/keyManager.js';
import {
  MAX_CIPHER_FILE_BYTES,
  createCipherFile,
  parseCipherFile,
} from './lib/cipherFile.js';

function describeCryptoError(error) {
  const code = error?.code || error?.message;
  switch (code) {
    case 'AUTH_FAILED':
    case 'PADDING_INVALID':
      return 'تعذّر فك التشفير: المفتاح أو النمط أو IV لا يطابق هذه البيانات.';
    case 'INVALID_KEY_LENGTH':
      return 'طول المفتاح لا يطابق النمط المطلوب.';
    case 'KEY_MISMATCH':
    case 'MODE_MISMATCH':
      return 'معطيات الحزمة لا تطابق العملية. أعد ضبط النمط وطول المفتاح.';
    case 'INVALID_IV':
      return 'متجه التهيئة غير صالح — يتطلب 32 خانة سداسية (128 بت).';
    case 'WORKER_UNAVAILABLE':
    case 'WORKER_TERMINATED':
    case 'WORKER_CRASHED':
    case 'WORKER_MESSAGE_ERROR':
      return 'تعذّر تشغيل محرّك التشفير المحلي. أعد تحميل الصفحة.';
    case 'INVALID_PAYLOAD':
    case 'DATA_TRUNCATED':
      return 'بيانات الصورة غير مكتملة أو تالفة.';
    case 'IMAGE_TOO_LARGE':
      return 'أبعاد الصورة أكبر من الحد الآمن للمعالجة. استخدم صورة أصغر.';
    default:
      return 'حدث خطأ غير متوقع أثناء المعالجة. تحقّق من المفتاح والبيانات.';
  }
}

function describeFileError(error) {
  const code = error?.message;
  if (code === 'FILE_TRUNCATED') return 'حزمة .sitr غير مكتملة أو تالفة.';
  if (code === 'FILE_INVALID' || code === 'FILE_VERSION') {
    return 'ملف .sitr غير صالح أو بإصدار غير مدعوم.';
  }
  return 'تعذّر قراءة الحزمة المشفّرة.';
}

export default function App() {
  const { run } = useAesWorker();

  const [operation, setOperation] = useState('encrypt');
  const [mode, setMode] = useState('ECB');
  const [keyBits, setKeyBits] = useState(256);
  const [keys, setKeys] = useState(() => ({
    128: generateKeyHex(128),
    256: generateKeyHex(256),
  }));
  const [ivHex, setIvHex] = useState(() => generateIvHex());

  const [image, setImage] = useState(null);
  const [reference, setReference] = useState(null);
  const [view, setView] = useState(null);
  const [cipher, setCipher] = useState(null);
  const [stats, setStats] = useState(null);
  const [activePreset, setActivePreset] = useState(null);

  const [comparisonMode, setComparisonMode] = useState('single');
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingImage, setLoadingImage] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState(null);

  const loadToken = useRef(0);

  const keyHex = keys[keyBits];
  const keyValid = isHexOfLength(keyHex, keyBits / 4);
  const ivValid = isHexOfLength(ivHex, 32);
  const canCompare = Boolean(reference && view && view.kind !== 'original');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message, tone = 'success') {
    setToast({ message, tone, id: Date.now() });
  }

  function resetComparison() {
    setComparisonMode('single');
    setCompareOriginal(false);
  }

  function applySource(prepared, meta) {
    const entropy = computeEntropy(prepared.rgb);
    setImage({ ...prepared, ...meta });
    setReference({
      imageData: prepared.imageData,
      width: prepared.width,
      height: prepared.height,
      name: meta.name,
    });
    setView({
      imageData: prepared.imageData,
      kind: 'original',
      width: prepared.width,
      height: prepared.height,
      sourceWidth: prepared.width,
      sourceHeight: prepared.height,
    });
    setStats({
      originalEntropy: entropy,
      cipherEntropy: null,
      currentEntropy: entropy,
      blocks: null,
      duration: null,
    });
    setCipher(null);
    setOperation('encrypt');
    setProgress(0);
    setActionError('');
    resetComparison();
  }

  async function handlePreset(preset) {
    if (busy) return;
    const token = (loadToken.current += 1);
    setLoadingImage(true);
    setActionError('');
    try {
      const element = await loadImageElement(preset.src);
      if (token !== loadToken.current) return;
      const prepared = prepareImage(element);
      applySource(prepared, {
        name: preset.name,
        fileName: preset.name,
        sizeBytes: null,
        presetId: preset.id,
      });
      setActivePreset(preset.id);
      notify(`تم تحميل نموذج ${preset.name} — ${prepared.width}×${prepared.height} بكسل.`);
    } catch {
      if (token === loadToken.current) {
        const message = 'تعذّر تحميل النموذج المحدد. حاول مرة أخرى.';
        setActionError(message);
        notify(message, 'error');
      }
    } finally {
      if (token === loadToken.current) setLoadingImage(false);
    }
  }

  async function importCipherFile(file) {
    if (busy) return;
    const token = (loadToken.current += 1);
    setLoadingImage(true);
    setActionError('');
    try {
      if (file.size > MAX_CIPHER_FILE_BYTES) {
        throw Object.assign(new Error('FILE_TOO_LARGE'), { code: 'FILE_TOO_LARGE' });
      }
      const buffer = await file.arrayBuffer();
      if (token !== loadToken.current) return;
      const parsed = parseCipherFile(buffer);
      if (token !== loadToken.current) return;

      const preview = buildCipherImageData(parsed.cipher);
      const entropy = computeEntropy(parsed.cipher);
      setCipher({
        bytes: parsed.cipher,
        width: preview.width,
        height: preview.height,
        displayWidth: preview.width,
        displayHeight: preview.height,
        previewTruncated: preview.truncated,
        mode: parsed.mode,
        keyBits: parsed.keyBits,
        ivHex: parsed.ivHex,
        sourceName: file.name.replace(/\.sitr$/i, '') || 'image',
        sourceWidth: null,
        sourceHeight: null,
      });
      setMode(parsed.mode);
      setIvHex(parsed.ivHex);
      if (parsed.keyBits) setKeyBits(parsed.keyBits);
      setImage(null);
      setReference(null);
      setActivePreset(null);
      setView({
        imageData: preview.imageData,
        kind: 'encrypted',
        width: preview.width,
        height: preview.height,
        sourceWidth: null,
        sourceHeight: null,
      });
      setStats({
        originalEntropy: null,
        cipherEntropy: entropy,
        currentEntropy: entropy,
        blocks: blockCount(parsed.cipher.length),
        duration: null,
      });
      setOperation('decrypt');
      setProgress(0);
      resetComparison();
      notify(
        `تم استيراد الحزمة (SITR v1 · ${parsed.mode}) — النمط و IV تم استخراجهما. الصق المفتاح (64 خانة = 256 بت، 32 = 128 بت) لفك التشفير.`,
      );
    } catch (error) {
      if (token !== loadToken.current) return;
      const message =
        error?.code === 'FILE_TOO_LARGE'
          ? 'حجم الحزمة يتجاوز الحد المسموح (80 م.ب).'
          : describeFileError(error);
      setActionError(message);
      notify(message, 'error');
    } finally {
      if (token === loadToken.current) setLoadingImage(false);
    }
  }

  /**
   * Try to interpret a PNG as an encrypted-pixel image. Returns true when
   * the file was recognized (and decrypted), false when it is a normal
   * image that should follow the source-image path.
   */
  async function importEncryptedPng(file) {
    if (busy) return false;
    const token = (loadToken.current += 1);
    setLoadingImage(true);
    setActionError('');
    try {
      const { imageData } = await loadImagePixelsFromFile(file);
      if (token !== loadToken.current) return true;

      const pixels = imageDataToRgb(imageData);
      const key = hexToBytes(keyHex);
      const iv = ivValid ? hexToBytes(ivHex) : new Uint8Array(16);
      const result = await run(
        'decrypt-pixels',
        { cipher: pixels, mode, key, iv },
        setProgress,
      );
      if (token !== loadToken.current) return true;

      const cipherBytes = pixels.slice(0, result.cipherLength);
      const cipherEntropy = computeEntropy(cipherBytes);
      const restored = bytesToImageData(result.rgb, result.width, result.height);
      const restoredEntropy = computeEntropy(result.rgb);

      setCipher({
        bytes: cipherBytes,
        width: imageData.width,
        height: imageData.height,
        displayWidth: imageData.width,
        displayHeight: imageData.height,
        previewTruncated: false,
        mode,
        keyBits: result.keyBits,
        ivHex: bytesToHex(iv),
        sourceName: file.name.replace(/\.[^.]+$/, ''),
        sourceWidth: result.width,
        sourceHeight: result.height,
      });
      setImage(null);
      setReference({
        imageData: restored,
        width: result.width,
        height: result.height,
        name: 'restored',
      });
      setActivePreset(null);
      setView({
        imageData: restored,
        kind: 'decrypted',
        width: result.width,
        height: result.height,
        sourceWidth: result.width,
        sourceHeight: result.height,
      });
      setStats({
        originalEntropy: restoredEntropy,
        cipherEntropy,
        currentEntropy: restoredEntropy,
        blocks: blockCount(cipherBytes.length),
        duration: null,
      });
      setKeyBits(result.keyBits);
      setOperation('encrypt');
      setProgress(0);
      resetComparison();
      notify('تم التعرف على صورة PNG مشفّرة وفك تشفيرها بالمفتاح والنمط الحاليين.');
      return true;
    } catch (error) {
      if (token !== loadToken.current) return true;
      if (error?.code === 'IMAGE_TOO_LARGE' || error?.message === 'IMAGE_TOO_LARGE') {
        const message = describeCryptoError(error);
        setActionError(message);
        notify(message, 'error');
        return true;
      }
      return false;
    } finally {
      if (token === loadToken.current) setLoadingImage(false);
    }
  }

  async function handleFile(file) {
    if (!file || busy) return;
    if (isCipherFile(file)) {
      await importCipherFile(file);
      return;
    }

    const problem = validateImageFile(file);
    if (problem) {
      setActionError(problem);
      notify(problem, 'error');
      return;
    }

    const looksEncryptedName = /cipher|encrypted|مشفّر/i.test(file.name);
    const shouldProbe = isPngFile(file) && keyValid && (operation === 'decrypt' || looksEncryptedName);

    if (shouldProbe) {
      const handled = await importEncryptedPng(file);
      if (handled) return;
      if (looksEncryptedName) {
        const message =
          'تعذّر التعرف على صورة PNG مشفّرة — تأكد من النمط والمفتاح و IV، أو استورد ملف .sitr.';
        setActionError(message);
        notify(message, 'error');
        return;
      }
    }

    const token = (loadToken.current += 1);
    setLoadingImage(true);
    setActionError('');
    try {
      const element = await loadImageFromFile(file);
      if (token !== loadToken.current) return;
      const prepared = prepareImage(element);
      applySource(prepared, {
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        sizeBytes: file.size,
        presetId: null,
      });
      setActivePreset(null);
      notify(
        prepared.scaled
          ? `تم تحميل الصورة وأُعيد تحجيمها إلى ${prepared.width}×${prepared.height} لأداء أفضل.`
          : `تم تحميل الصورة — ${prepared.width}×${prepared.height} بكسل.`,
      );
    } catch {
      if (token === loadToken.current) {
        const message = 'تعذّر فك ترميز الصورة. جرّب ملف PNG أو JPG أو WebP.';
        setActionError(message);
        notify(message, 'error');
      }
    } finally {
      if (token === loadToken.current) setLoadingImage(false);
    }
  }

  async function handleEncrypt() {
    if (busy) return;
    if (!view) {
      setActionError('حمّل صورة أو اختر نموذجاً قبل تنفيذ التشفير.');
      return;
    }
    if (view.kind === 'encrypted') {
      setActionError('هذه المعاينة مشفّرة بالفعل. بدّل العملية إلى «فك التشفير».');
      return;
    }
    if (!keyValid) {
      setActionError(`أكمل مفتاح ${keyBits} بت (${keyBits / 4} خانة سداسية) أولاً.`);
      return;
    }
    if (mode !== 'ECB' && !ivValid) {
      setActionError('متجه التهيئة يحتاج 32 خانة سداسية قبل التشفير.');
      return;
    }

    const key = hexToBytes(keyHex);
    const ivBytes = ivValid ? hexToBytes(ivHex) : new Uint8Array(16);
    const rgb = imageDataToRgb(view.imageData);
    const sourceWidth = view.width;
    const sourceHeight = view.height;
    const started = performance.now();

    setBusy(true);
    setProgress(0);
    setActionError('');

    try {
      const result = await run(
        'encrypt',
        {
          rgb,
          width: sourceWidth,
          height: sourceHeight,
          mode,
          key,
          iv: mode === 'ECB' ? undefined : ivBytes,
        },
        setProgress,
      );

      const cipherBytes = result.cipher;
      const cipherEntropy = computeEntropy(cipherBytes);
      const sourceEntropy = computeEntropy(rgb);
      const preview = buildCipherImageData(cipherBytes, sourceWidth);

      setCipher({
        bytes: cipherBytes,
        width: preview.width,
        height: preview.height,
        displayWidth: preview.width,
        displayHeight: preview.height,
        previewTruncated: preview.truncated,
        mode,
        keyBits,
        ivHex: bytesToHex(ivBytes),
        sourceName: image?.name || image?.fileName || 'image',
        sourceWidth,
        sourceHeight,
      });
      setReference((previous) =>
        previous ?? {
          imageData: view.imageData,
          width: sourceWidth,
          height: sourceHeight,
          name: image?.name || 'original',
        },
      );
      setView({
        imageData: preview.imageData,
        kind: 'encrypted',
        width: preview.width,
        height: preview.height,
        sourceWidth,
        sourceHeight,
      });
      setStats({
        originalEntropy: sourceEntropy,
        cipherEntropy,
        currentEntropy: cipherEntropy,
        blocks: blockCount(cipherBytes.length),
        duration: performance.now() - started,
      });
      setOperation('decrypt');
      setProgress(1);
      resetComparison();
      notify(
        mode === 'ECB'
          ? 'تم التشفير — تأمّل بقاء الأنماط البصرية، وهو السلوك المتوقع لـ ECB.'
          : 'تم تشفير الصورة بنجاح داخل المتصفح.',
      );
    } catch (error) {
      const message = describeCryptoError(error);
      setActionError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function handleDecrypt() {
    if (busy) return;
    if (!cipher) {
      setActionError('لا توجد حزمة مشفّرة. شفّر صورة أولاً أو استورد ملف .sitr / PNG.');
      return;
    }
    if (cipher.keyBits != null && !isHexOfLength(keyHex, cipher.keyBits / 4)) {
      setActionError(
        `مفتاح هذه الحزمة بطول ${cipher.keyBits} بت (${cipher.keyBits / 4} خانة سداسية).`,
      );
      return;
    }
    if (!keyValid) {
      setActionError('أكمل المفتاح قبل فك التشفير، أو اختر الطول المطابق للحزمة.');
      return;
    }

    const key = hexToBytes(keyHex);
    const iv = hexToBytes(cipher.ivHex) || new Uint8Array(16);
    const started = performance.now();

    setBusy(true);
    setProgress(0);
    setActionError('');

    try {
      const result = await run(
        'decrypt',
        { cipher: cipher.bytes, mode: cipher.mode, key, iv },
        setProgress,
      );

      const restoredEntropy = computeEntropy(result.rgb);
      const restored = bytesToImageData(result.rgb, result.width, result.height);

      setView({
        imageData: restored,
        kind: 'decrypted',
        width: result.width,
        height: result.height,
        sourceWidth: result.width,
        sourceHeight: result.height,
      });
      setReference((previous) =>
        previous ?? {
          imageData: restored,
          width: result.width,
          height: result.height,
          name: 'restored',
        },
      );
      setCipher((previous) =>
        previous
          ? {
              ...previous,
              keyBits: result.keyBits,
              sourceWidth: result.width,
              sourceHeight: result.height,
            }
          : previous,
      );
      setKeyBits(result.keyBits);
      setStats((previous) => ({
        originalEntropy: previous?.originalEntropy ?? restoredEntropy,
        cipherEntropy: previous?.cipherEntropy ?? computeEntropy(cipher.bytes),
        currentEntropy: restoredEntropy,
        blocks: blockCount(cipher.bytes.length),
        duration: performance.now() - started,
      }));
      setOperation('encrypt');
      setProgress(1);
      notify('تم فك التشفير واستعادة الصورة الأصلية بنجاح.');
    } catch (error) {
      const message = describeCryptoError(error);
      setActionError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  function handleReset() {
    if (busy) return;
    setActionError('');
    setCompareOriginal(false);
    if (image) {
      const entropy = computeEntropy(image.rgb);
      setView({
        imageData: image.imageData,
        kind: 'original',
        width: image.width,
        height: image.height,
        sourceWidth: image.width,
        sourceHeight: image.height,
      });
      setStats((previous) => ({
        originalEntropy: entropy,
        cipherEntropy: previous?.cipherEntropy ?? null,
        currentEntropy: entropy,
        blocks: previous?.blocks ?? null,
        duration: null,
      }));
      setOperation('encrypt');
      setProgress(0);
      return;
    }
    if (cipher) {
      const entropy = computeEntropy(cipher.bytes);
      const displayWidth = cipher.displayWidth ?? cipher.width;
      const displayHeight = cipher.displayHeight ?? cipher.height;
      setView({
        imageData: bytesToImageData(cipher.bytes, displayWidth, displayHeight),
        kind: 'encrypted',
        width: displayWidth,
        height: displayHeight,
        sourceWidth: cipher.sourceWidth ?? null,
        sourceHeight: cipher.sourceHeight ?? null,
      });
      setStats((previous) => ({
        ...previous,
        currentEntropy: entropy,
      }));
      setOperation('decrypt');
      setProgress(0);
    }
  }

  async function handleDownloadPng() {
    if (!view) return;
    try {
      let imageData = view.imageData;
      let suffix = 'original';

      if (view.kind === 'encrypted' && cipher) {
        const full = buildCipherImageDataForExport(
          cipher.bytes,
          cipher.displayWidth ?? cipher.width,
        );
        if (!full) {
          notify('الحزمة أكبر من حد تصدير PNG. استخدم ملف .sitr للحفاظ على كل البايتات.', 'error');
          return;
        }
        imageData = full.imageData;
        suffix = `${cipher.mode || mode}-cipher`;
      } else if (view.kind === 'decrypted') {
        suffix = 'restored';
      }

      if (compareOriginal && reference) {
        imageData = reference.imageData;
        suffix = 'original';
      }

      const canvas = imageDataToCanvas(imageData);
      const blob = await canvasToBlob(canvas);
      const base = sanitizeFilename(cipher?.sourceName || image?.name || 'sitr-image');
      downloadBlob(blob, `${base}-${suffix}.png`);
      notify(
        view.kind === 'encrypted' && !compareOriginal
          ? 'تم تنزيل صورة PNG مشفّرة — أعد استيرادها في وضع فك التشفير بنفس النمط والمفتاح و IV، أو استخدم .sitr.'
          : 'تم تنزيل الصورة بصيغة PNG.',
      );
    } catch {
      notify('تعذّر تصدير الصورة. حاول مرة أخرى.', 'error');
    }
  }

  function handleDownloadPackage() {
    if (!cipher) return;
    try {
      const iv = hexToBytes(cipher.ivHex) || new Uint8Array(16);
      const file = createCipherFile({
        cipher: cipher.bytes,
        mode: cipher.mode,
        iv,
      });
      downloadBlob(
        file.blob,
        `${sanitizeFilename(cipher.sourceName)}-${cipher.mode}-${cipher.keyBits ?? keyBits}.sitr`,
      );
      notify('تم تنزيل الحزمة (SITR v1). النمط و IV مضمّنان — احتفظ بالمفتاح وطوله.');
    } catch {
      notify('تعذّر إنشاء الحزمة المشفّرة.', 'error');
    }
  }

  function handleModeChange(nextMode) {
    if (busy) return;
    setMode(nextMode);
    setActionError('');
    if (nextMode !== 'ECB' && !ivValid) setIvHex(generateIvHex());
  }

  function handleIvChange(value) {
    if (busy) return;
    setIvHex(normalizeHex(value, 32));
    setActionError('');
  }

  function handleRegenerateIv() {
    if (busy) return;
    setIvHex(generateIvHex());
    notify('تم توليد متجه تهيئة عشوائي جديد (128 بت).');
  }

  function handleKeyChange(value) {
    if (busy) return;
    setKeys((previous) => ({
      ...previous,
      [keyBits]: normalizeHex(value, keyBits / 4),
    }));
    setActionError('');
  }

  function handleKeyPaste(value) {
    if (busy) return;
    const hex = normalizeHex(value, 64);
    if (hex.length === 64) {
      setKeys((previous) => ({ ...previous, 256: hex }));
      setKeyBits(256);
    } else if (hex.length === 32) {
      setKeys((previous) => ({ ...previous, 128: hex }));
      setKeyBits(128);
    } else {
      setKeys((previous) => ({
        ...previous,
        [keyBits]: normalizeHex(value, keyBits / 4),
      }));
    }
    setActionError('');
  }

  function handleKeyBitsChange(bits) {
    if (busy || bits === keyBits) return;
    setKeyBits(bits);
    setActionError('');
  }

  function handleGenerateKey() {
    if (busy) return;
    setKeys((previous) => ({ ...previous, [keyBits]: generateKeyHex(keyBits) }));
    setActionError('');
    notify(`تم توليد مفتاح ${keyBits} بت عشوائي عبر مولّد آمن (CSPRNG).`);
  }

  async function handleDeriveKey(passphrase) {
    if (busy) return;
    const derived = await deriveKeyFromPassphrase(passphrase, keyBits);
    setKeys((previous) => ({ ...previous, [keyBits]: derived }));
    setActionError('');
    notify(`تم اشتقاق مفتاح ${keyBits} بت باستخدام PBKDF2-SHA256.`);
  }

  async function handleCopyKey() {
    try {
      await copyText(keyHex);
      notify('تم نسخ المفتاح إلى الحافظة.');
    } catch {
      notify('تعذّر النسخ إلى الحافظة.', 'error');
    }
  }

  function handleOperationChange(nextOperation) {
    if (busy) return;
    setOperation(nextOperation);
    setActionError('');
    if (
      nextOperation === 'decrypt' &&
      cipher?.keyBits != null &&
      keyBits !== cipher.keyBits
    ) {
      setKeyBits(cipher.keyBits);
    }
  }

  function handleComparisonModeChange(nextMode) {
    setComparisonMode(nextMode);
    if (nextMode !== 'single') setCompareOriginal(false);
  }

  function handleCompareOriginalChange() {
    setComparisonMode('single');
    setCompareOriginal((value) => !value);
  }

  let ctaReason = '';
  if (!busy) {
    if (operation === 'encrypt') {
      if (!keyValid) {
        ctaReason = `أكمل مفتاح ${keyBits} بت (${keyBits / 4} خانة سداسية).`;
      } else if (mode !== 'ECB' && !ivValid) {
        ctaReason = 'أكمل متجه التهيئة (32 خانة سداسية).';
      } else if (!view) {
        ctaReason = 'حمّل صورة أو اختر نموذجاً للبدء.';
      } else if (view.kind === 'encrypted') {
        ctaReason = 'الناتج مشفّر بالفعل — بدّل العملية إلى «فك التشفير».';
      }
    } else if (!cipher) {
      ctaReason = 'لا توجد حزمة مشفّرة في الجلسة. شفّر صورة أو استورد ملف .sitr / PNG.';
    } else if (cipher.keyBits != null && !isHexOfLength(keyHex, cipher.keyBits / 4)) {
      ctaReason = `مفتاح هذه الحزمة بطول ${cipher.keyBits} بت (${cipher.keyBits / 4} خانة سداسية).`;
    } else if (!keyValid) {
      ctaReason = 'أكمل المفتاح أو اختر الطول المطابق للحزمة.';
    } else if (view?.kind === 'decrypted') {
      ctaReason = 'تمت استعادة الصورة بالفعل. بدّل العملية إلى «تشفير».';
    }
  }

  const canReset = !busy && Boolean(view && view.kind !== 'original' && (image || cipher));

  return (
    <div id="top" className="min-h-screen bg-porcelain">
      <Header />
      <main>
        <Hero />
        <div id="lab" className="mx-auto w-full max-w-[1440px] px-5 pb-14 sm:px-8 sm:pb-16">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-6 xl:gap-8">
            <Sidebar
              operation={operation}
              onOperationChange={handleOperationChange}
              mode={mode}
              onModeChange={handleModeChange}
              ivHex={ivHex}
              onIvChange={handleIvChange}
              onRegenerateIv={handleRegenerateIv}
              ivValid={ivValid}
              image={image}
              view={view}
              cipher={cipher}
              activePreset={activePreset}
              loadingImage={loadingImage}
              onFile={handleFile}
              onPreset={handlePreset}
              keyBits={keyBits}
              onKeyBitsChange={handleKeyBitsChange}
              keyHex={keyHex}
              onKeyChange={handleKeyChange}
              onKeyPaste={handleKeyPaste}
              keyValid={keyValid}
              onGenerateKey={handleGenerateKey}
              onDeriveKey={handleDeriveKey}
              onCopyKey={handleCopyKey}
              onExecute={operation === 'encrypt' ? handleEncrypt : handleDecrypt}
              busy={busy}
              ctaReason={ctaReason}
              actionError={actionError}
            />

            <CanvasStage
              view={view}
              reference={reference}
              cipher={cipher}
              stats={stats}
              busy={busy}
              progress={progress}
              operation={operation}
              mode={mode}
              keyBits={keyBits}
              comparisonMode={comparisonMode}
              onComparisonModeChange={handleComparisonModeChange}
              compareOriginal={compareOriginal}
              onCompareOriginalChange={handleCompareOriginalChange}
              splitPosition={splitPosition}
              onSplitPositionChange={setSplitPosition}
              onDownloadPng={handleDownloadPng}
              onDownloadPackage={handleDownloadPackage}
              onReset={handleReset}
              canReset={canReset}
              canCompare={canCompare}
              onPreset={handlePreset}
              onFile={handleFile}
              loadingImage={loadingImage}
            />
          </div>
        </div>
      </main>
      <Footer />
      <Toast toast={toast} />
    </div>
  );
}
