import { Info, RefreshCw } from 'lucide-react';
import { MODES } from '../lib/constants.js';
import { cn } from '../lib/encoding.js';

export default function ModeSelector({
  mode,
  onChange,
  ivHex,
  onIvChange,
  onRegenerateIv,
  ivValid,
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

      {mode !== 'ECB' && (
        <div className="mt-2.5 animate-fade rounded-[12px] border border-hairline bg-white/70 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="iv-field" className="text-[10px] font-medium text-graphite">
              {mode === 'CBC' ? 'متجه التهيئة (IV)' : 'العدّاد الأولي (Nonce / IV)'}
            </label>
            <button
              type="button"
              onClick={onRegenerateIv}
              disabled={disabled}
              className="grid h-5 w-5 place-items-center rounded-[5px] text-muted transition-colors hover:bg-cloud hover:text-inkstone disabled:cursor-not-allowed disabled:opacity-40"
              title="توليد قيمة عشوائية جديدة"
              aria-label="توليد قيمة عشوائية جديدة"
            >
              <RefreshCw size={10} aria-hidden="true" />
            </button>
          </div>

          <input
            id="iv-field"
            dir="ltr"
            value={ivHex}
            onChange={(event) => onIvChange(event.target.value)}
            disabled={disabled}
            maxLength={32}
            spellCheck={false}
            autoComplete="off"
            placeholder="32 hex characters"
            aria-invalid={!ivValid}
            className={cn(
              'ltr mt-1.5 w-full rounded-[8px] border bg-white px-2.5 py-2 font-mono text-[10px] tracking-[0.03em] outline-none transition-colors focus:border-signal',
              ivValid ? 'border-hairline' : 'border-danger/40',
            )}
          />

          {!ivValid ? (
            <p className="mt-1 text-[9px] text-danger">القيمة تحتاج 32 خانة سداسية (128 بت).</p>
          ) : (
            <p className="mt-1 text-[9px] leading-4 text-muted">
              {mode === 'CBC'
                ? 'يُدمج مع الكتلة الأولى قبل التشفير، ويُحفظ مع الحزمة.'
                : 'يُشفَّر العدّاد المتزايد لإنتاج تدفق المفاتيح.'}
            </p>
          )}
        </div>
      )}

      {operation === 'decrypt' && hasCipher && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-[9px] bg-white/60 px-2 py-1.5 text-[9px] leading-4 text-muted">
          <Info size={11} className="mt-[1px] shrink-0" aria-hidden="true" />
          <span>
            فك تشفير <span className="font-mono">.sitr</span> يستخدم النمط و IV المحفوظين داخل
            الحزمة. أما صور PNG المشفّرة فتستخدم النمط و IV المعروضين أعلاه.
          </span>
        </p>
      )}
    </div>
  );
}
