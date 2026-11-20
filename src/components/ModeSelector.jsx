import { Info } from 'lucide-react';
import { MODES } from '../lib/constants.js';
import { cn } from '../lib/encoding.js';

export default function ModeSelector({
  mode,
  onChange,
  operation,
  hasCipher,
  disabled = false,
}) {
  return (
    <div>
      <div className="space-y-1" role="group" aria-label="نمط تشفير AES">
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.id)}
              disabled={disabled}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-[12px] border px-2.5 py-2.5 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                active
                  ? 'border-signal bg-white'
                  : 'border-transparent hover:bg-white/60',
              )}
            >
              <span
                className={cn(
                  'mt-[4px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border transition-colors',
                  active ? 'border-signal' : 'border-hairline-strong bg-white',
                )}
                aria-hidden="true"
              >
                {active && <span className="h-[6px] w-[6px] rounded-full bg-signal" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-[10.5px] font-semibold tracking-[0.07em] text-inkstone">
                    {item.id}
                  </span>
                  <span className="text-[11.5px] font-medium text-inkstone">{item.name}</span>
                </span>

                <span className="mt-0.5 block text-[9px] leading-4 text-muted">{item.hint}</span>

                {active && (
                  <span className="mt-1 block animate-fade text-[9.5px] leading-4 text-muted">
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex items-start gap-1.5 rounded-[9px] bg-white/60 px-2 py-1.5 text-[9px] leading-4 text-muted">
        <Info size={11} className="mt-[1px] shrink-0" aria-hidden="true" />
        <span>
          {mode === 'ECB'
            ? 'نمط ECB لا يستخدم IV — أدرج المفتاح والمعاملات من الخطوة 3.'
            : 'أدرج المفتاح و IV (32 خانة سداسية) من الخطوة 3 لإتمام الإعداد.'}
        </span>
      </p>

      {operation === 'decrypt' && hasCipher && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-[9px] bg-white/60 px-2 py-1.5 text-[9px] leading-4 text-muted">
          <Info size={11} className="mt-[1px] shrink-0" aria-hidden="true" />
          <span>
            فك تشفير <span className="font-mono">.sitr</span> يستخدم النمط و IV المحفوظين داخل
            الحزمة. أما صور PNG المشفّرة فتستخدم النمط و IV المعروضين في الخطوة 3.
          </span>
        </p>
      )}
    </div>
  );
}
