import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { KEY_SIZES, PBKDF2_ITERATIONS } from '../lib/constants.js';
import { cn, formatNumber } from '../lib/encoding.js';

export default function KeyPanel({
  keyBits,
  onKeyBitsChange,
  keyHex,
  onKeyChange,
  keyValid,
  onGenerate,
  onDerive,
  onCopy,
  disabled = false,
}) {
  const [passphraseOpen, setPassphraseOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  const charLength = keyBits / 4;

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
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

      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="key-hex" className="text-[10px] font-medium text-graphite">
            المفتاح بصيغة Hex
          </label>
          <span className="font-mono text-[9px] text-muted tnum">
            {keyHex.length}/{charLength}
          </span>
        </div>

        <div className="relative mt-1">
          <input
            id="key-hex"
            dir="ltr"
            value={keyHex}
            onChange={(event) => onKeyChange(event.target.value)}
            disabled={disabled}
            maxLength={charLength}
            spellCheck={false}
            autoComplete="off"
            placeholder={keyBits === 256 ? '64 hex · 256-bit key' : '32 hex · 128-bit key'}
            aria-invalid={!keyValid}
            className={cn(
              'ltr h-10 w-full rounded-[9px] border bg-white px-2.5 pe-9 font-mono text-[10px] tracking-[0.01em] outline-none transition-colors focus:border-signal',
              keyValid ? 'border-hairline' : 'border-danger/40',
            )}
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={!keyValid || disabled}
            title="نسخ المفتاح"
            aria-label="نسخ المفتاح"
            className="absolute end-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[7px] text-muted transition-colors hover:bg-cloud hover:text-inkstone disabled:opacity-30"
          >
            {copied ? (
              <Check size={12} className="text-signal" aria-hidden="true" />
            ) : (
              <Copy size={12} aria-hidden="true" />
            )}
          </button>
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
