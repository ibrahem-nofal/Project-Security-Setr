import BrandMark from './BrandMark.jsx';

export default function Footer() {
  return (
    <footer id="privacy" className="border-t border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-9 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <BrandMark size={30} />
            <div>
              <p className="text-[12px] font-semibold leading-5">سِتر — مختبر تشفير الصور</p>
              <p className="mt-0.5 max-w-[380px] text-[10px] leading-5 text-muted">
                معالجة كاملة داخل المتصفح. لا خوادم، لا تحليلات، ولا تخزين للصور أو
                المفاتيح. المفاتيح العشوائية تُولَّد عبر مولّد أرقام آمن تشفيرياً (CSPRNG).
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[9px] leading-5 text-muted sm:items-end sm:text-end">
            <p className="font-mono tracking-[0.04em]">
              AES · FIPS-197 · WEB WORKER · PBKDF2-SHA256
            </p>
            <p>
              النماذج: Tux — Larry Ewing (CC BY-SA) · Alice — John Tenniel (Public Domain)
            </p>
            <p className="text-graphite">
              أداة تعليمية وأكاديمية. لا تُستخدم ECB لحماية بيانات حقيقية.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
