import { CircleAlert, Check } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="animate-rise pointer-events-auto flex max-w-[92vw] items-center gap-2.5 rounded-pill border border-white/10 bg-inkstone px-4 py-2.5 text-[12px] leading-5 text-white"
      >
        {toast.tone === 'error' ? (
          <CircleAlert size={14} className="shrink-0 text-white/80" aria-hidden="true" />
        ) : (
          <Check size={14} className="shrink-0 text-signal" aria-hidden="true" />
        )}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
