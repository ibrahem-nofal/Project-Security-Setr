const SPECS = [
  { value: '256', label: 'بت أقصى مفتاح' },
  { value: '03', label: 'أنماط تشفير' },
  { value: '00', label: 'بايت يغادر جهازك' },
];

export default function Hero() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-14">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="max-w-[680px] animate-rise">
          <div className="flex items-center gap-2.5">
            <span className="h-[5px] w-[5px] rounded-[1px] bg-signal" aria-hidden="true" />
            <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted">
              Image Cryptography · AES
            </p>
          </div>

          <h1 className="mt-4 text-[34px] font-semibold leading-[1.18] tracking-[-0.015em] text-inkstone sm:text-[46px] lg:text-[54px]">
            <span className="block">شفّر صورتك،</span>
            <span className="block">بكسل بكسل.</span>
          </h1>

          <p className="mt-4 max-w-[560px] text-[12.5px] leading-6 text-muted sm:mt-5 sm:text-[14px] sm:leading-7">
            مختبر تفاعلي لتشفير الصور وفك تشفيرها داخل متصفحك باستخدام AES. اختر النمط
            والمفتاح، ثم راقب كيف يتغيّر النسيج البصري لكل بكسل — دون أن تغادر بياناتك جهازك.
          </p>
        </div>

        <div className="hidden shrink-0 overflow-hidden rounded-[16px] border border-hairline bg-white lg:flex">
          {SPECS.map((spec, index) => (
            <div
              key={spec.label}
              className={`flex min-w-[112px] flex-col gap-0.5 px-5 py-3.5 ${
                index > 0 ? 'border-s border-hairline' : ''
              }`}
            >
              <span className="font-mono text-[19px] font-medium leading-none tracking-[-0.02em] text-inkstone tnum">
                {spec.value}
              </span>
              <span className="mt-1.5 text-[10px] leading-4 text-muted">{spec.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
