import {
  ArrowLeft,
  CircleAlert,
  Info,
  LoaderCircle,
  Lock,
  LockKeyhole,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { cn } from '../lib/encoding.js';
import StepSection from './StepSection.jsx';
import ModeSelector from './ModeSelector.jsx';
import ImagePanel from './ImagePanel.jsx';
import KeyPanel from './KeyPanel.jsx';

export default function Sidebar({
  operation,
  onOperationChange,
  mode,
  onModeChange,
  ivHex,
  onIvChange,
  onRegenerateIv,
  ivValid,
  image,
  view,
  cipher,
  activePreset,
  loadingImage,
  onFile,
  onPreset,
  keyBits,
  onKeyBitsChange,
  keyHex,
  onKeyChange,
  keyValid,
  onGenerateKey,
  onDeriveKey,
  onCopyKey,
  onExecute,
  busy,
  ctaReason,
  actionError,
}) {
  return (
    <aside className="order-2 w-full rounded-shell bg-cloud p-5 sm:p-6 lg:order-1">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          Control Panel
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-white px-2 py-1 text-[9px] text-muted">
          <span className="h-1 w-1 rounded-full bg-signal" aria-hidden="true" />
          {cipher ? 'حزمة جاهزة' : 'محلي بالكامل'}
        </span>
      </div>

      <div
        className="mt-3 grid grid-cols-2 gap-1 rounded-pill border border-hairline bg-white p-1"
        role="group"
        aria-label="اختيار العملية"
      >
        <button
          type="button"
          aria-pressed={operation === 'encrypt'}
          onClick={() => onOperationChange('encrypt')}
          disabled={busy}
          className={cn(
            'flex h-[34px] items-center justify-center gap-1.5 rounded-pill text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
            operation === 'encrypt'
              ? 'bg-signal text-white'
              : 'text-muted hover:text-inkstone',
          )}
        >
          <Lock size={12} aria-hidden="true" />
          تشفير
        </button>
        <button
          type="button"
          aria-pressed={operation === 'decrypt'}
          onClick={() => onOperationChange('decrypt')}
          disabled={busy}
          className={cn(
            'flex h-[34px] items-center justify-center gap-1.5 rounded-pill text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
            operation === 'decrypt'
              ? 'bg-signal text-white'
              : 'text-muted hover:text-inkstone',
          )}
        >
          <Unlock size={12} aria-hidden="true" />
          فك التشفير
        </button>
      </div>

      {cipher && (
        <div className="mt-2 flex items-center gap-1.5 rounded-[9px] border border-hairline bg-white/70 px-2 py-1.5">
          <LockKeyhole size={11} className="shrink-0 text-signal" aria-hidden="true" />
          <span className="truncate text-[9px] text-graphite" title={cipher.sourceName}>
            {cipher.sourceName}
          </span>
          <span className="ms-auto shrink-0 font-mono text-[8.5px] text-muted">
            {cipher.mode} · {cipher.keyBits}
          </span>
        </div>
      )}

      <div className="mt-5">
        <StepSection number="01" title="نمط التشفير" hint="ECB · CBC · CTR — مع أطوال 128/256">
          <ModeSelector
            mode={mode}
            onChange={onModeChange}
            ivHex={ivHex}
            onIvChange={onIvChange}
            onRegenerateIv={onRegenerateIv}
            ivValid={ivValid}
            operation={operation}
            hasCipher={Boolean(cipher)}
            disabled={busy}
          />
        </StepSection>

        <StepSection number="02" title="الصورة المصدر" hint="ارفع ملفاً محلياً أو اختر نموذجاً">
          <ImagePanel
            image={image}
            view={view}
            cipher={cipher}
            activePreset={activePreset}
            loading={loadingImage || busy}
            onFile={onFile}
            onPreset={onPreset}
          />
        </StepSection>

        <StepSection number="03" title="إدارة المفتاح" hint="توليد عشوائي آمن أو اشتقاق من جملة">
          <KeyPanel
            keyBits={keyBits}
            onKeyBitsChange={onKeyBitsChange}
            keyHex={keyHex}
            onKeyChange={onKeyChange}
            keyValid={keyValid}
            onGenerate={onGenerateKey}
            onDerive={onDeriveKey}
            onCopy={onCopyKey}
            disabled={busy}
          />
        </StepSection>
      </div>

      <div className="mt-5 border-t border-hairline pt-5">
        {actionError && (
          <div
            role="alert"
            className="mb-2.5 flex items-start gap-2 rounded-[10px] border border-danger/25 bg-white px-2.5 py-2 text-[9.5px] leading-4 text-danger"
          >
            <CircleAlert size={13} className="mt-[1px] shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onExecute}
          disabled={Boolean(ctaReason) || busy}
          aria-describedby={ctaReason ? 'cta-reason' : undefined}
          className={cn(
            'group flex h-[52px] w-full items-center gap-2.5 rounded-pill px-5 text-[12.5px] font-semibold transition-all',
            'bg-signal text-white enabled:hover:bg-signal-deep enabled:active:scale-[0.995]',
            'disabled:bg-cloud-deep disabled:text-[#9a9a92]',
          )}
        >
          {busy ? (
            <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
          ) : operation === 'encrypt' ? (
            <Lock size={15} aria-hidden="true" />
          ) : (
            <Unlock size={15} aria-hidden="true" />
          )}
          <span>{busy ? 'جارٍ التنفيذ…' : operation === 'encrypt' ? 'تشفير الصورة' : 'فك تشفير الصورة'}</span>
          {!busy && (
            <ArrowLeft
              size={16}
              className="ms-auto opacity-80 transition-transform group-enabled:group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
          )}
        </button>

        {ctaReason && (
          <p
            id="cta-reason"
            className="mt-2 flex items-start justify-center gap-1.5 text-center text-[9px] leading-4 text-muted"
          >
            <Info size={11} className="mt-[2px] shrink-0" aria-hidden="true" />
            <span>{ctaReason}</span>
          </p>
        )}

        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[8.5px] leading-4 text-muted">
          <ShieldCheck size={11} className="shrink-0 text-signal" aria-hidden="true" />
          يعمل بالكامل داخل متصفحك — لا تُرسل الصور أو المفاتيح إلى أي خادم.
        </p>
      </div>
    </aside>
  );
}
