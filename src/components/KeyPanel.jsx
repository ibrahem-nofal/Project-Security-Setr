import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { KEY_SIZES, PBKDF2_ITERATIONS } from '../lib/constants.js';
import { cn, formatNumber } from '../lib/encoding.js';

export default function KeyPanel({
  mode,
  keyBits,
  onKeyBitsChange,
  keyHex,
  onKeyChange,
  onKeyPaste,
  keyValid,
  onGenerate,
  onDerive,
  onCopy,
  ivHex,
  onIvChange,
  onRegenerateIv,
  ivValid,
  onCopyIv,
  disabled = false,
}) {
  const [passphraseOpen, setPassphraseOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState('');
  const [copied, setCopied] = useState(false);
  const [ivCopied, setIvCopied] = useState(false);
  const copyTimer = useRef(null);
  const ivCopyTimer = useRef(null);

  const charLength = keyBits / 4;
  const needsIv = mode !== 'ECB';

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      if (ivCopyTimer.current) window.clearTimeout(ivCopyTimer.current);
    };
  }, []);

  async function handleDerive(event) {
    event.preventDefault();
    if (passphrase.trim().length < 4) {
      setDeriveError('استخدم 4 أحرف على الأقل لاشتقاق مفتاح مفيد.');
      return;
    }
    setDeriving(true);
    setDeriveError('');
    try {
      await onDerive(passphrase);
      setPassphrase('');
      setShowPassphrase(false);
      setPassphraseOpen(false);
    } catch {
      setDeriveError('تعذّر اشتقاق المفتاح. حاول مرة أخرى.');
    } finally {
      setDeriving(false);
    }
  }

  function handleCopy() {
    onCopy();
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  function handleCopyIv() {
    if (!onCopyIv) return;
    onCopyIv();
    setIvCopied(true);
    if (ivCopyTimer.current) window.clearTimeout(ivCopyTimer.current);
    ivCopyTimer.current = window.setTimeout(() => setIvCopied(false), 1600);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium text-graphite">طول المفتاح</span>
        <div
          className="flex rounded-pill border border-hairline bg-white p-0.5"
          role="group"
          aria-label="طول مفتاح AES"
        >
          {KEY_SIZES.map((bits) => (
            <button
              key={bits}
              type="button"
              aria-pressed={keyBits === bits}
              onClick={() => onKeyBitsChange(bits)}
              disabled={disabled}
              className={cn(
                'h-[26px] w-[50px] rounded-pill font-mono text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                keyBits === bits
                  ? 'bg-signal text-white'
                  : 'text-muted hover:text-inkstone',
              )}
            >
              {bits}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="key-hex" className="text-[10px] font-medium text-graphite">
              المفتاح بصيغة Hex
            </label>
            <span className="font-mono text-[9px] text-muted tnum">
              {keyHex.length}/{charLength}
            </span>
          </div>

          <div className="relative mt-1" dir="ltr">
            <input
              id="key-hex"
              dir="ltr"
              value={keyHex}
              onChange={(event) => onKeyChange(event.target.value)}
              onPaste={(event) => {
                if (!onKeyPaste) return;
                const text = event.clipboardData?.getData('text');
                if (!text) return;
                event.preventDefault();
                onKeyPaste(text);
              }}
              disabled={disabled}
              maxLength={charLength}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={keyBits === 256 ? '64 hex · 256-bit key' : '32 hex · 128-bit key'}
              aria-invalid={!keyValid}
              className={cn(
                'ltr block h-10 w-full rounded-[9px] border bg-white pl-3 pr-12 font-mono text-[10px] tracking-[0.01em] outline-none transition-colors focus:border-signal',
                keyValid ? 'border-hairline' : 'border-danger/40',
              )}
            />
            <span className="pointer-events-none absolute right-1.5 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[7px] bg-white">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!keyValid || disabled}
                title="نسخ المفتاح"
                aria-label="نسخ المفتاح"
                className="pointer-events-auto grid h-7 w-7 place-items-center rounded-[7px] text-muted transition-colors hover:bg-cloud hover:text-inkstone disabled:opacity-30"
              >
                {copied ? (
                  <Check size={12} className="text-signal" aria-hidden="true" />
                ) : (
                  <Copy size={12} aria-hidden="true" />
                )}
              </button>
            </span>
          </div>

          <p
            className={cn(
              'mt-1 text-[9px] leading-4',
              keyValid ? 'text-muted' : 'text-danger',
            )}
          >
            {keyValid
              ? `مفتاح ${keyBits} بت · ${charLength} خانة سداسية`
              : `أدخل ${charLength} خانة سداسية صحيحة (0–9، a–f)`}
          </p>
        </div>

        <div className="rounded-[11px] border border-hairline bg-white/70 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="iv-field"
              className="text-[10px] font-medium text-graphite"
            >
              {mode === 'CTR' ? 'العدّاد الأولي (Nonce / IV)' : 'متجه التهيئة (IV)'}
            </label>
            {needsIv && (
              <span className="font-mono text-[9px] text-muted tnum">
                {(ivHex?.length ?? 0)}/32
              </span>
            )}
          </div>

          {needsIv ? (
            <>
              <div className="relative mt-1" dir="ltr">
                <input
                  id="iv-field"
                  dir="ltr"
                  value={ivHex}
                  onChange={(event) => onIvChange?.(event.target.value)}
                  disabled={disabled}
                  maxLength={32}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder="32 hex · 128-bit IV"
                  aria-invalid={!ivValid}
                  className={cn(
                    'ltr block h-9 w-full rounded-[8px] border bg-white pl-2.5 pr-[4.5rem] font-mono text-[10px] tracking-[0.02em] outline-none transition-colors focus:border-signal',
                    ivValid ? 'border-hairline' : 'border-danger/40',
                  )}
                />
                <span className="pointer-events-none absolute right-1.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-[7px] bg-white">
                  <button
                    type="button"
                    onClick={onRegenerateIv}
                    disabled={disabled}
                    title="توليد IV جديد"
                    aria-label="توليد IV جديد"
                    className="pointer-events-auto grid h-6 w-6 place-items-center rounded-[6px] text-muted transition-colors hover:bg-cloud hover:text-inkstone disabled:opacity-30"
                  >
                    <RefreshCw size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyIv}
                    disabled={!ivValid || disabled}
                    title="نسخ متجه التهيئة"
                    aria-label="نسخ متجه التهيئة"
                    className="pointer-events-auto grid h-6 w-6 place-items-center rounded-[6px] text-muted transition-colors hover:bg-cloud hover:text-inkstone disabled:opacity-30"
                  >
                    {ivCopied ? (
                      <Check size={11} className="text-signal" aria-hidden="true" />
                    ) : (
                      <Copy size={11} aria-hidden="true" />
                    )}
                  </button>
                </span>
              </div>
              <p
                className={cn(
                  'mt-1 text-[9px] leading-4',
                  ivValid ? 'text-muted' : 'text-danger',
                )}
              >
                {ivValid
                  ? mode === 'CBC'
                    ? '32 خانة سداسية · يُدمج مع الكتلة الأولى ويُحفظ مع الحزمة.'
                    : '32 خانة سداسية · عدّاد ابتدائي لتوليد تدفق المفاتيح.'
                  : 'أدخل 32 خانة سداسية صحيحة (128 بت).'}
              </p>
            </>
          ) : (
            <div
              id="iv-field"
              className="mt-1 flex items-center gap-1.5 rounded-[8px] border border-hairline bg-cloud/70 px-2.5 py-2 text-[9px] leading-4 text-muted"
            >
              <Info size={11} className="shrink-0" aria-hidden="true" />
              <span>نمط ECB لا يتطلب IV — كل كتلة تُشفَّر مباشرة بالمفتاح.</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled}
          className="inline-flex h-[36px] items-center justify-center gap-1.5 rounded-[9px] border border-signal-line bg-signal-soft text-[10.5px] font-medium text-signal transition-colors hover:bg-signal-line/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={12} aria-hidden="true" />
          توليد
        </button>
        <button
          type="button"
          onClick={() => {
            setPassphraseOpen((value) => !value);
            setDeriveError('');
          }}
          disabled={disabled}
          aria-expanded={passphraseOpen}
          className={cn(
            'inline-flex h-[36px] items-center justify-center gap-1.5 rounded-[9px] border bg-white text-[10.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            passphraseOpen
              ? 'border-signal-line text-signal'
              : 'border-hairline text-graphite hover:border-hairline-strong',
          )}
        >
          <KeyRound size={12} aria-hidden="true" />
          من جملة
        </button>
      </div>

      {passphraseOpen && (
        <form
          onSubmit={handleDerive}
          className="mt-2 animate-fade rounded-[11px] border border-hairline bg-white p-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="passphrase" className="text-[10px] font-medium text-graphite">
              الجملة السرية
            </label>
            <button
              type="button"
              onClick={() => setShowPassphrase((value) => !value)}
              className="grid h-5 w-5 place-items-center rounded-[5px] text-muted transition-colors hover:text-inkstone"
              aria-label={showPassphrase ? 'إخفاء الجملة' : 'إظهار الجملة'}
            >
              {showPassphrase ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>

          <input
            id="passphrase"
            type={showPassphrase ? 'text' : 'password'}
            value={passphrase}
            onChange={(event) => {
              setPassphrase(event.target.value);
              setDeriveError('');
            }}
            disabled={disabled || deriving}
            autoComplete="new-password"
            placeholder="جملة سهلة التذكّر…"
            className="mt-1.5 h-9 w-full rounded-[7px] border border-hairline bg-white px-2 text-[11px] outline-none transition-colors focus:border-signal"
          />

          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="max-w-[180px] text-[8.5px] leading-3.5 text-muted">
              PBKDF2-SHA256 · {formatNumber(PBKDF2_ITERATIONS)} دورة · ملح ثابت
            </p>
            <button
              type="submit"
              disabled={deriving || disabled}
              className="inline-flex h-7 items-center gap-1 rounded-pill bg-signal px-2.5 text-[9px] font-medium text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deriving ? (
                <LoaderCircle size={9} className="animate-spin" aria-hidden="true" />
              ) : (
                <WandSparkles size={9} aria-hidden="true" />
              )}
              {deriving ? 'جارٍ الاشتقاق…' : 'اشتقاق'}
            </button>
          </div>

          {deriveError && (
            <p role="alert" className="mt-1 text-[9px] leading-4 text-danger">
              {deriveError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
