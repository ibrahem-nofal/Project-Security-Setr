import { useEffect, useRef } from 'react';
import {
  Download,
  FileKey,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  Lock,
  RotateCcw,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { MODE_INSIGHTS } from '../lib/constants.js';
import { PRESETS } from '../lib/presets.js';
import { cn, formatDuration, formatNumber } from '../lib/encoding.js';

function StatCell({ label, value, unit }) {
  return (
    <div className="rounded-[14px] bg-cloud px-3 py-2.5">
      <p className="text-[9px] text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="ltr font-mono text-[14px] font-medium leading-none text-inkstone tnum">
          {value}
        </span>
        <span className="font-mono text-[8px] leading-none text-muted">{unit}</span>
      </div>
    </div>
  );
}

function ToolButton({ label, text, icon, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-[32px] items-center gap-1.5 rounded-pill border border-hairline bg-white px-2.5 text-[9.5px] font-medium text-graphite transition-colors hover:border-hairline-strong disabled:cursor-not-allowed disabled:opacity-35"
    >
      {icon}
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}

function EntropyBar({ label, value, accent }) {
  const percentage = value == null ? 0 : Math.min(100, (value / 8) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] text-muted">{label}</span>
        <span className="font-mono text-[9px] text-graphite tnum">
          {value == null ? '—' : value.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 h-[3px] overflow-hidden rounded-pill bg-hairline">
        <div
          className={cn('h-full rounded-pill transition-[width] duration-500', accent ? 'bg-signal' : 'bg-inkstone/45')}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function CanvasStage({
  view,
  cipher,
  stats,
  busy,
  progress,
  operation,
  mode,
  keyBits,
  onDownloadPng,
  onDownloadPackage,
  onReset,
  canReset,
  onPreset,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view) return;
    canvas.width = view.width;
    canvas.height = view.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(view.imageData, 0, 0);
  }, [view]);

  const stageMode = view && view.kind !== 'original' && cipher ? cipher.mode : mode;
  const stageBits = view && view.kind !== 'original' && cipher ? cipher.keyBits : keyBits;
  const insight = MODE_INSIGHTS[stageMode];
  const viewLabel =
    view?.kind === 'encrypted' ? 'مشفّرة' : view?.kind === 'decrypted' ? 'مستعادة' : 'أصلية';

  return (
    <section className="order-1 w-full lg:order-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            Workspace / 01
          </p>
          <h2 className="mt-1 text-[20px] font-semibold leading-7">المعاينة الحيّة</h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-[32px] items-center gap-1.5 rounded-pill border px-2.5 text-[9.5px] font-medium',
              view?.kind === 'encrypted'
                ? 'border-signal-line bg-signal-soft text-signal'
                : 'border-hairline bg-white text-graphite',
            )}
          >
            {view?.kind === 'encrypted' ? (
              <Lock size={10} aria-hidden="true" />
            ) : view?.kind === 'decrypted' ? (
              <Unlock size={10} aria-hidden="true" />
            ) : (
              <ImageIcon size={10} aria-hidden="true" />
            )}
            {view ? viewLabel : 'فارغة'}
          </span>

          <ToolButton
            label="تنزيل معاينة PNG"
            text="PNG"
            icon={<Download size={11} aria-hidden="true" />}
            onClick={onDownloadPng}
            disabled={!view || busy}
          />
          <ToolButton
            label="تنزيل حزمة .sitr"
            text="حزمة"
            icon={<FileKey size={11} aria-hidden="true" />}
            onClick={onDownloadPackage}
            disabled={!cipher || busy}
          />
          <ToolButton
            label="استعادة الصورة الأصلية"
            text="استعادة"
            icon={<RotateCcw size={11} aria-hidden="true" />}
            onClick={onReset}
            disabled={!canReset}
          />
        </div>
      </div>

      <div className="relative mt-3.5 overflow-hidden rounded-shell bg-cloud p-2.5 sm:p-4">
        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[26px] border border-hairline bg-white sm:min-h-[480px]">
          {view ? (
            <div className="checker flex h-full w-full items-center justify-center p-4 sm:p-7">
              <canvas
                ref={canvasRef}
                className="block h-auto max-h-[56vh] w-auto max-w-full rounded-[3px] outline outline-1 outline-black/5"
                aria-label="معاينة الصورة داخل مساحة العمل"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 animate-breathe rounded-[22px] bg-signal-soft blur-xl" />
                <div className="relative grid h-[66px] w-[66px] place-items-center rounded-[20px] border border-hairline bg-white">
                  <ImageIcon size={22} className="text-muted" aria-hidden="true" />
                  <span className="absolute -bottom-2 -end-2 grid h-7 w-7 place-items-center rounded-full bg-signal text-white">
                    <Lock size={11} aria-hidden="true" />
                  </span>
                </div>
              </div>

              <h3 className="text-[15px] font-semibold">لا توجد صورة في مساحة العمل</h3>
              <p className="mt-1.5 max-w-[340px] text-[11px] leading-5 text-muted">
                ارفع صورة من لوحة التحكم، أو ابدأ بنموذج جاهز لاختبار الفروق بين أنماط
                التشفير الثلاثة.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onPreset(preset)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3.5 text-[10px] font-medium text-graphite transition-colors hover:border-signal/40 hover:text-inkstone"
                  >
                    <img
                      src={preset.src}
                      alt=""
                      className="h-4 w-4 rounded-[3px] object-cover"
                      loading="lazy"
                    />
                    {preset.name}
                  </button>
                ))}
              </div>

              <p className="mt-6 flex items-center gap-1.5 text-[9px] text-muted">
                <ShieldCheck size={11} aria-hidden="true" />
                لا تُرفع الصورة إلى أي خادم
              </p>
            </div>
          )}

          {view && (
            <>
              <span className="pointer-events-none absolute start-3 top-3 rounded-pill border border-hairline bg-white/90 px-2.5 py-1 font-mono text-[8.5px] text-muted backdrop-blur-sm">
                AES · {stageMode} · {stageBits}
              </span>
              <span className="ltr pointer-events-none absolute end-3 top-3 rounded-pill border border-hairline bg-white/90 px-2.5 py-1 font-mono text-[8.5px] text-muted backdrop-blur-sm tnum">
                {view.width} × {view.height}
              </span>
            </>
          )}

          {busy && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 p-6 backdrop-blur-[3px]">
              <div className="w-[min(320px,86%)] rounded-[18px] border border-hairline bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium">
                    <LoaderCircle size={13} className="animate-spin text-signal" aria-hidden="true" />
                    {operation === 'encrypt' ? 'جارٍ تشفير البكسلات…' : 'جارٍ فك تشفير البكسلات…'}
                  </p>
                  <span className="font-mono text-[10px] text-muted tnum">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-cloud-deep">
                  <div
                    className="h-full rounded-pill bg-signal transition-[width] duration-200"
                    style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-[8.5px] tracking-[0.05em] text-muted">
                  AES-WORKER · {operation === 'encrypt' ? stageMode : cipher?.mode} ·{' '}
                  {operation === 'encrypt' ? keyBits : cipher?.keyBits}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1.5">
          <p className="text-[8.5px] leading-4 text-muted">
            تُشفَّر قنوات RGB فقط للحفاظ على العتامة البصرية للمعاينة.
          </p>
          <p className="font-mono text-[8.5px] tracking-[0.04em] text-muted">
            RGBA → RGB → AES
          </p>
        </div>
      </div>

      {view && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCell
            label="الأبعاد"
            value={`${view.width}×${view.height}`}
            unit="px"
          />
          <StatCell
            label="كتل AES"
            value={stats?.blocks == null ? '—' : formatNumber(stats.blocks)}
            unit="blk"
          />
          <StatCell
            label="زمن المعالجة"
            value={stats?.duration == null ? '—' : formatDuration(stats.duration)}
            unit="ms"
          />
          <StatCell
            label="إنتروبيا الناتج"
            value={stats?.currentEntropy == null ? '—' : stats.currentEntropy.toFixed(2)}
            unit="bit/B"
          />
        </div>
      )}

      <section
        id="insight"
        className="mt-2 grid gap-5 rounded-shell border border-hairline bg-white p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6"
      >
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted">
              Academic note
            </p>
            <span className="rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-[8px] text-muted">
              {stageMode}
            </span>
            <span
              className={cn(
                'rounded-pill px-1.5 py-0.5 text-[8px]',
                insight.tone === 'caution'
                  ? 'bg-signal-soft text-signal'
                  : 'bg-cloud text-graphite',
              )}
            >
              {insight.badge}
            </span>
          </div>

          <h3 className="mt-2.5 text-[15px] font-semibold leading-6">{insight.title}</h3>
          <p className="mt-2 max-w-[640px] text-[11px] leading-6 text-muted">{insight.body}</p>

          <div className="mt-3.5 inline-flex items-center gap-2 rounded-[7px] border border-hairline bg-cloud px-2.5 py-1.5">
            <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted">
              AES
            </span>
            <code dir="ltr" className="ltr font-mono text-[10px] text-graphite">
              {insight.formula}
            </code>
          </div>
        </div>

        <div className="rounded-[14px] bg-cloud p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[9.5px] font-medium text-graphite">طيف الإنتروبيا</p>
            <span className="font-mono text-[8px] text-muted">MAX 8.00</span>
          </div>

          <EntropyBar label="الأصل" value={stats?.originalEntropy ?? null} />
          <EntropyBar
            label="المشفّر"
            value={stats?.cipherEntropy ?? null}
            accent
          />

          <p className="mt-3 text-[8.5px] leading-4 text-muted">
            {stats?.cipherEntropy == null
              ? 'نفّذ التشفير لعرض إنتروبيا الناتج ومقارنتها بالأصل.'
              : 'القيم قريبة من 8.00 تعني توزيعاً شبه مثالي للبايتات في الناتج المشفّر.'}
          </p>

          {cipher && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-2.5 text-[8.5px] text-muted">
              <Info size={10} aria-hidden="true" />
              <span className="font-mono">
                {cipher.mode} · {cipher.keyBits}
              </span>
              <span>· IV {cipher.ivHex ? 'محفوظ' : '—'}</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
