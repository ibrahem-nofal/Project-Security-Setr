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
  prepareImage,
  validateImageFile,
} from './lib/imagePipeline.js';
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
      return 'تعذّر فك التشفير: المفتاح لا يطابق هذه الحزمة، أو البيانات تالفة.';
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
  const [view, setView] = useState(null);
  const [cipher, setCipher] = useState(null);
  const [stats, setStats] = useState(null);
  const [activePreset, setActivePreset] = useState(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingImage, setLoadingImage] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState(null);

  const loadToken = useRef(0);

  const keyHex = keys[keyBits];
  const keyValid = isHexOfLength(keyHex, keyBits / 4);
  const ivValid = isHexOfLength(ivHex, 32);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message, tone = 'success') {
    setToast({ message, tone, id: Date.now() });
  }

  function applySource(prepared, meta) {
    const entropy = computeEntropy(prepared.rgb);
    setImage({ ...prepared, ...meta });
    setView({
      imageData: prepared.imageData,
      kind: 'original',
      width: prepared.width,
      height: prepared.height,
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
      const entropy = computeEntropy(parsed.cipher);
      setCipher({
        bytes: parsed.cipher,
        width: parsed.width,
        height: parsed.height,
        mode: parsed.mode,
        keyBits: parsed.keyBits,
        ivHex: parsed.ivHex,
        sourceName: parsed.sourceName,
        fileName: file.name,
      });
      setMode(parsed.mode);
      setKeyBits(parsed.keyBits);
      setIvHex(parsed.ivHex);
      setImage(null);
      setActivePreset(null);
      setView({
        imageData: bytesToImageData(parsed.cipher, parsed.width, parsed.height),
        kind: 'encrypted',
        width: parsed.width,
        height: parsed.height,
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
      notify(`تم استيراد الحزمة (${parsed.mode} · ${parsed.keyBits} بت) — أدخل المفتاح لفك التشفير.`);
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
    const started = performance.now();

    setBusy(true);
    setProgress(0);
    setActionError('');

    try {
      const result = await run(
        'encrypt',
        {
          rgb,
          width: view.width,
          height: view.height,
          mode,
          key,
          iv: mode === 'ECB' ? undefined : ivBytes,
        },
        setProgress,
      );

      const cipherBytes = result.cipher;
      const cipherEntropy = computeEntropy(cipherBytes);
      const sourceEntropy = computeEntropy(rgb);

      setCipher({
        bytes: cipherBytes,
        width: view.width,
        height: view.height,
        mode,
        keyBits,
        ivHex: bytesToHex(ivBytes),
        sourceName: image?.name || image?.fileName || 'image',
        fileName: image?.fileName || null,
      });
      setView({
        imageData: bytesToImageData(cipherBytes, view.width, view.height),
        kind: 'encrypted',
        width: view.width,
        height: view.height,
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
      setActionError('لا توجد حزمة مشفّرة. شفّر صورة أولاً أو استورد ملف .sitr.');
      return;
    }
    if (!isHexOfLength(keyHex, cipher.keyBits / 4)) {
      setActionError(
        `مفتاح هذه الحزمة بطول ${cipher.keyBits} بت (${cipher.keyBits / 4} خانة سداسية).`,
      );
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
      setView({
        imageData: bytesToImageData(result.rgb, result.width, result.height),
        kind: 'decrypted',
        width: result.width,
        height: result.height,
      });
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
    if (image) {
      const entropy = computeEntropy(image.rgb);
      setView({
        imageData: image.imageData,
        kind: 'original',
        width: image.width,
        height: image.height,
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
      setView({
        imageData: bytesToImageData(cipher.bytes, cipher.width, cipher.height),
        kind: 'encrypted',
        width: cipher.width,
        height: cipher.height,
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
      const canvas = imageDataToCanvas(view.imageData);
      const blob = await canvasToBlob(canvas);
      const base = sanitizeFilename(cipher?.sourceName || image?.name || 'sitr-image');
      const suffix =
        view.kind === 'encrypted'
          ? `${cipher?.mode || mode}-cipher`
          : view.kind === 'decrypted'
            ? 'restored'
            : 'original';
      downloadBlob(blob, `${base}-${suffix}.png`);
      notify(
        view.kind === 'encrypted'
          ? 'تم تنزيل معاينة الناتج PNG. لفك التشفير لاحقاً استخدم حزمة .sitr.'
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
        width: cipher.width,
        height: cipher.height,
        mode: cipher.mode,
        keyBits: cipher.keyBits,
        iv,
        sourceName: cipher.sourceName,
      });
      downloadBlob(
        file.blob,
        `${sanitizeFilename(cipher.sourceName)}-${cipher.mode}-${cipher.keyBits}.sitr`,
      );
      notify('تم تنزيل الحزمة. احتفظ بالمفتاح — لا يمكن فك التشفير بدونه.');
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
    if (nextOperation === 'decrypt' && cipher && keyBits !== cipher.keyBits) {
      setKeyBits(cipher.keyBits);
    }
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
      ctaReason = 'لا توجد حزمة مشفّرة في الجلسة. شفّر صورة أو استورد ملف .sitr.';
    } else if (!isHexOfLength(keyHex, cipher.keyBits / 4)) {
      ctaReason = `مفتاح هذه الحزمة بطول ${cipher.keyBits} بت (${cipher.keyBits / 4} خانة سداسية).`;
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
              cipher={cipher}
              stats={stats}
              busy={busy}
              progress={progress}
              operation={operation}
              mode={mode}
              keyBits={keyBits}
              onDownloadPng={handleDownloadPng}
              onDownloadPackage={handleDownloadPackage}
              onReset={handleReset}
              canReset={canReset}
              onPreset={handlePreset}
            />
          </div>
        </div>
      </main>
      <Footer />
      <Toast toast={toast} />
    </div>
  );
}
