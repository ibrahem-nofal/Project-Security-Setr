import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/encoding.js';

function PixelCanvas({ imageData, className, style, label }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !imageData) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    ctx.imageSmoothingEnabled = false;
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
        'pointer-events-none z-20 rounded-pill border px-2.5 py-1 text-[8.5px] font-medium backdrop-blur-sm',
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  if (!view) return null;

  const comparisonAvailable = canCompare && Boolean(reference);
  const decryptFlow = comparisonAvailable && view.kind === 'decrypted';

  const beforeLabel = decryptFlow ? 'المشفّرة المرفوعة' : 'الصورة الأصلية';
  const beforeShortLabel = decryptFlow ? 'قبل (المشفّرة)' : 'قبل (الأصلية)';
  const afterLabel = decryptFlow ? 'الصورة المستعادة' : 'الصورة المشفّرة';
  const afterShortLabel = decryptFlow ? 'بعد (المستعادة)' : 'بعد (المشفّرة)';
  const afterBadge = decryptFlow ? 'المستعادة' : 'المشفّرة';

  const showReference = comparisonAvailable && flip && mode === 'single';
  const singleImage = showReference ? reference.imageData : view.imageData;

  function updateSplitFromClientX(clientX) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    onSplitChange?.(clamp(next, 0, 100));
  }

  function handlePointerDown(event) {
    if (!comparisonAvailable) return;
    event.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateSplitFromClientX(event.clientX);
  }

  function handlePointerMove(event) {
    if (!draggingRef.current) return;
    event.preventDefault();
    updateSplitFromClientX(event.clientX);
  }

  function stopDragging(event) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (comparisonAvailable && mode === 'side') {
    return (
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        <figure className="relative flex min-h-[190px] flex-col overflow-hidden rounded-[10px] border border-hairline bg-white">
          <figcaption className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
            <span className="text-[9.5px] font-medium text-graphite">{beforeLabel}</span>
            <span className="font-mono text-[8px] text-muted">BEFORE</span>
          </figcaption>
          <div className="checker flex flex-1 items-center justify-center p-2">
            <PixelCanvas
              imageData={reference.imageData}
              className="block h-auto max-h-[44vh] w-auto max-w-full rounded-[3px] outline outline-1 outline-black/5"
              label={beforeLabel}
            />
          </div>
        </figure>

        <figure className="relative flex min-h-[190px] flex-col overflow-hidden rounded-[10px] border border-signal-line bg-white">
          <figcaption className="flex items-center justify-between gap-2 border-b border-signal-line bg-signal-soft/60 px-2.5 py-1.5">
            <span className="text-[9.5px] font-medium text-signal">{afterLabel}</span>
            <span className="font-mono text-[8px] text-signal/80">AFTER</span>
          </figcaption>
          <div className="checker flex flex-1 items-center justify-center p-2">
            <PixelCanvas
              imageData={view.imageData}
              className="block h-auto max-h-[44vh] w-auto max-w-full rounded-[3px] outline outline-1 outline-black/5"
              label={afterLabel}
            />
          </div>
        </figure>
      </div>
    );
  }

  if (comparisonAvailable && mode === 'split') {
    const position = clamp(Number(split) || 0, 0, 100);
    return (
      <div className="flex w-full flex-col items-center gap-2.5">
        <div
          ref={containerRef}
          className={cn(
            'relative w-full max-w-full overflow-hidden rounded-[10px] border border-hairline bg-white select-none',
            dragging ? 'cursor-ew-resize' : 'cursor-col-resize',
          )}
          style={{
            height: 'min(56vh, 520px)',
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          role="group"
          aria-label="مقارنة تفاعلية بين الصورة قبل وبعد المعالجة"
        >
          <div className="checker absolute inset-0" aria-hidden="true" />
          <PixelCanvas
            imageData={view.imageData}
            className="absolute inset-0 h-full w-full object-contain"
            label={afterLabel}
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            aria-hidden="true"
          >
            <PixelCanvas
              imageData={reference.imageData}
              className="absolute inset-0 h-full w-full object-contain"
              label={beforeLabel}
            />
          </div>

          <span
            className="pointer-events-none absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 bg-signal shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
            style={{ left: `${position}%` }}
            aria-hidden="true"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute top-1/2 z-20 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-signal text-white shadow-md focus:outline-none"
            style={{ left: `${position}%`, cursor: dragging ? 'ew-resize' : 'col-resize' }}
            aria-hidden="true"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M3.5 2 1 5l2.5 3M6.5 2 9 5 6.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <Label className="absolute bottom-2 left-2">{beforeShortLabel}</Label>
          <Label tone="signal" className="absolute bottom-2 right-2">
            {afterShortLabel}
          </Label>
        </div>

        <div className="flex w-full max-w-[460px] items-center gap-2.5 px-1">
          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">
            BEFORE
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={position}
            dir="ltr"
            onChange={(event) => onSplitChange?.(Number(event.target.value))}
            aria-label="تحريك خط المقارنة بين الصورة قبل وبعد المعالجة"
            className="h-2 flex-1 cursor-ew-resize appearance-none rounded-pill bg-hairline-strong accent-signal"
            style={{ accentColor: '#594ff4' }}
          />
          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">
            AFTER
          </span>
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
          label={showReference ? beforeLabel : 'معاينة الصورة داخل مساحة العمل'}
        />
      </div>

      {showReference && (
        <Label className="absolute bottom-3 left-1/2 -translate-x-1/2">
          {beforeLabel}
        </Label>
      )}
    </div>
  );
}
