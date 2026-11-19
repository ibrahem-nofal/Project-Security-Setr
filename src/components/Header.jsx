import BrandMark from './BrandMark.jsx';

const NAV_ITEMS = [
  { label: 'المختبر', href: '#lab' },
  { label: 'القراءة الأكاديمية', href: '#insight' },
  { label: 'الخصوصية', href: '#privacy' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-porcelain/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="سِتر — الصفحة الرئيسية">
          <BrandMark size={38} />
          <span className="flex flex-col">
            <span className="text-[17px] font-semibold leading-[1.2] tracking-tight">سِتر</span>
            <span className="mt-0.5 text-[10px] leading-3 text-muted">مختبر تشفير الصور</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[12px] font-medium text-muted transition-colors hover:text-inkstone"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-cloud px-2.5 py-1.5 text-[10px] font-medium text-graphite">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-30" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            معالجة محلية
          </span>
          <span className="hidden items-center rounded-pill border border-hairline px-2.5 py-1.5 font-mono text-[9.5px] tracking-[0.04em] text-muted sm:inline-flex">
            AES · FIPS-197
          </span>
        </div>
      </div>
    </header>
  );
}
