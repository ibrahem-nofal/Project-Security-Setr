import { cn } from '../lib/encoding.js';

export default function StepSection({ number, title, hint, children, className }) {
  return (
    <section
      className={cn(
        'mt-5 border-t border-hairline pt-5 first:mt-0 first:border-t-0 first:pt-0',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-[1px] flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full bg-signal font-mono text-[10px] font-semibold leading-none text-white tnum">
          {number}
        </span>
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold leading-[1.4] text-inkstone">{title}</h3>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted">{hint}</p>
        </div>
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
