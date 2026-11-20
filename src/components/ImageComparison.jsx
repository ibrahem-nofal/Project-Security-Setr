import { useEffect, useRef } from 'react';
import { cn } from '../lib/encoding.js';

function PixelCanvas({ imageData, className, style, label }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !imageData) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    ctx.putImageData(imageData, 0, 0);
  }, [imageData]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={style}
      role="img"
      aria-label={label}
    />
  );
}

function Label({ children, tone = 'neutral', className }) {
  return (
    <span
      className={cn(
        'pointer-events-none rounded-pill border px-2.5 py-1 text-[8.5px] font-medium backdrop-blur-sm',
        tone === 'signal'
          ? 'border-signal-line bg-signal-soft/95 text-signal'
          : 'border-hairline bg-white/90 text-graphite',
        className,
      )}
    >
      {children}
    </span>
  );
}

export default function ImageComparison({
  reference,
  view,
  mode = 'single',
  split = 50,
  onSplitChange,
  flip = false,
  canCompare = false,
}) {
  if (!view) return null;

  const comparisonAvailable = canCompare && Boolean(reference);
  const showReference = comparisonAvailable && flip && mode === 'single';
  const currentLabel =
    view.kind === 'encrypted' ? 'المشفّرة' : view.kind === 'decrypted' ? 'المستعادة' : 'الحالية';
  const singleImage = showReference ? reference.imageData : view.imageData;

  if (comparisonAvailable && mode === 'side') {
    return (
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        <figure className="relative flex min-h-[190px] flex-col overflow-hidden rounded-[10px] border border-hairline bg-white">
          <figcaption className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
            <span className="text-[9.5px] font-medium text-graphite">الصورة الأصلية</span>
            <span className="font-mono text-[8px] text-muted">BEFORE</span>
          </figcaption>
          <div className="checker flex flex-1 items-center justify-center p-2">
            <PixelCanvas
              imageData={reference.imageData}
              className="block h-auto max-h-[44vh] w-auto max-w-full rounded-[3px] outline outline-1 outline-black/5"
              label="الصورة الأصلية"
            />
          </div>
        </figure>

        <figure className="relative flex min-h-[190px] flex-col overflow-hidden rounded-[10px] border border-signal-line bg-white">
          <figcaption className="flex items-center justify-between gap-2 border-b border-signal-line bg-signal-soft/60 px-2.5 py-1.5">
            <span className="text-[9.5px] font-medium text-signal">
              {view.kind === 'decrypted' ? 'الصورة المستعادة' : 'الصورة المشفّرة'}
            </span>
            <span className="font-mono text-[8px] text-signal/80">AFTER</span>
          </figcaption>
          <div className="checker flex flex-1 items-center justify-center p-2">
            <PixelCanvas
              imageData={view.imageData}
              className="block h-auto max-h-[44vh] w-auto max-w-full rounded-[3px] outline outline-1 outline-black/5"
              label={currentLabel}
            />
          </div>
        </figure>
      </div>
    );
  }

  if (comparisonAvailable && mode === 'split') {
    const position = Math.max(0, Math.min(100, split));
    return (
      <div className="flex w-full flex-col items-center gap-2.5">
        <div
          className="relative w-full overflow-hidden rounded-[10px] border border-hairline bg-white"
          style={{ aspectRatio: `${view.width} / ${view.height}` }}
        >
          <PixelCanvas
            imageData={view.imageData}
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: 'fill' }}
            label={currentLabel}
          />
          <PixelCanvas
            imageData={reference.imageData}
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: 'fill', clipPath: `inset(0 ${100 - position}% 0 0)` }}
            label="الصورة الأصلية"
          />

          <span
            className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-signal shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
            style={{ left: `${position}%` }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute top-1/2 z-20 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-signal text-white shadow-sm"
            style={{ left: `${position}%` }}
            aria-hidden="true"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M3.5 2.5 1 5l2.5 2.5M6.5 2.5 9 5 6.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <Label className="absolute bottom-2 left-2">الأصلية</Label>
          <Label tone="signal" className="absolute bottom-2 right-2">
            {currentLabel}
          </Label>
        </div>

        <div className="flex w-full max-w-[420px] items-center gap-2.5 px-1">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">BEFORE</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={position}
            dir="ltr"
            onChange={(event) => onSplitChange?.(Number(event.target.value))}
            aria-label="تحريك المقارنة بين الصورة الأصلية والمشفّرة"
            className="h-1.5 flex-1 cursor-ew-resize appearance-none rounded-pill bg-hairline-strong accent-signal"
            style={{ accentColor: '#594ff4' }}
          />
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">AFTER</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="checker flex h-full w-full items-center justify-center p-4 sm:p-7">
        <PixelCanvas
          imageData={singleImage}
          className="block h-auto max-h-[56vh] w-auto max-w-full rounded-[3px] outline outline-1 outline-black/5"
          label={showReference ? 'الصورة الأصلية قبل التشفير' : 'معاينة الصورة داخل مساحة العمل'}
        />
      </div>

      {showReference && (
        <Label className="absolute bottom-3 left-1/2 -translate-x-1/2">قبل التشفير</Label>
      )}
    </div>
  );
}
