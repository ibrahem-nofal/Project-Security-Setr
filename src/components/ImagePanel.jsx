import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileImage,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import { PRESETS } from '../lib/presets.js';
import { cn } from '../lib/encoding.js';

export default function ImagePanel({
  image,
  view,
  cipher,
  activePreset,
  loading,
  onFile,
  onPreset,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(true);

  const loadedName = image?.fileName || cipher?.sourceName || null;
  const dimensions = view ? `${view.width} × ${view.height}` : null;

  function openPicker() {
    inputRef.current?.click();
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (loading) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.sitr"
        className="hidden"
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!loading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={openPicker}
          disabled={loading}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-[13px] border border-dashed bg-white/60 px-3 py-4 text-center transition-colors disabled:opacity-70',
            dragging
              ? 'border-signal bg-signal-soft'
              : 'border-hairline-strong hover:border-signal/50 hover:bg-white',
          )}
          aria-label="رفع صورة أو حزمة مشفّرة"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-signal-soft text-signal">
            {loading ? (
              <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={14} aria-hidden="true" />
            )}
          </span>
          <span className="text-[11.5px] font-medium leading-4 text-inkstone">
            {loading ? 'جارٍ قراءة الملف…' : 'اسحب صورة أو انقر للاختيار'}
          </span>
          <span className="text-[9px] leading-4 text-muted">
            PNG · JPG · WebP · .sitr — حتى 15 م.ب
          </span>
        </button>
      </div>

      {loadedName && (
        <div className="mt-2 flex items-center gap-1.5 rounded-[9px] border border-hairline bg-white/70 px-2 py-1.5">
          <FileImage size={12} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="truncate text-[9.5px] text-graphite" title={loadedName}>
            {loadedName}
          </span>
          {image?.scaled && (
            <span
              className="h-1 w-1 shrink-0 rounded-full bg-signal"
              title={`أُعيد تحجيمها من ${image.originalWidth} × ${image.originalHeight} لأداء أفضل`}
            />
          )}
          <span className="ltr ms-auto shrink-0 font-mono text-[8.5px] text-muted tnum">
            {dimensions}
          </span>
        </div>
      )}

      <div className="mt-3 rounded-[12px] border border-hairline bg-white/55">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <p className="text-[9.5px] font-medium text-graphite">نماذج جاهزة</p>
            <p className="truncate text-[8.5px] text-muted">
              {presetsOpen ? 'للاختبار السريع' : 'Tux · Alice · نقش'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPresetsOpen((value) => !value)}
            aria-expanded={presetsOpen}
            aria-controls="preset-grid"
            title={presetsOpen ? 'إخفاء النماذج' : 'إظهار النماذج'}
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-pill border border-hairline bg-white px-2 text-[8.5px] font-medium text-muted transition-colors hover:border-signal/40 hover:text-signal"
          >
            {presetsOpen ? (
              <ChevronUp size={10} aria-hidden="true" />
            ) : (
              <ChevronDown size={10} aria-hidden="true" />
            )}
            {presetsOpen ? 'إخفاء' : 'إظهار'}
          </button>
        </div>

        {presetsOpen && (
          <div id="preset-grid" className="animate-fade grid grid-cols-3 gap-1.5 px-2 pb-2">
            {PRESETS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onPreset(preset)}
                  disabled={loading}
                  title={preset.note}
                  aria-pressed={active}
                  className={cn(
                    'group overflow-hidden rounded-[10px] border bg-white p-1 text-start transition-colors disabled:opacity-60',
                    active
                      ? 'border-signal'
                      : 'border-hairline hover:border-hairline-strong',
                  )}
                >
                  <span className="relative block h-[58px] overflow-hidden rounded-[6px] bg-cloud-deep">
                    <img
                      src={preset.src}
                      alt=""
                      className={cn(
                        'h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
                        preset.id === 'tux' ? 'object-[50%_30%]' : 'object-center',
                      )}
                      loading="lazy"
                    />
                    {active && (
                      <>
                        <span className="absolute inset-0 bg-signal/10" />
                        <span className="absolute end-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-signal text-white">
                          <Check size={9} aria-hidden="true" />
                        </span>
                      </>
                    )}
                  </span>
                  <span className="block px-0.5 pt-1">
                    <span className="block text-[9.5px] font-medium leading-3 text-inkstone">
                      {preset.name}
                    </span>
                    <span className="mt-0.5 block text-[8px] leading-3 text-muted">
                      {preset.meta}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
