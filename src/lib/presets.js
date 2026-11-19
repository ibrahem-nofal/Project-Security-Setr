import tuxUrl from '../assets/presets/tux.png';
import aliceUrl from '../assets/presets/alice.png';
import patternUrl from '../assets/presets/pattern.svg';

export const PRESETS = [
  {
    id: 'tux',
    name: 'Tux',
    meta: 'بنغوين لينكس',
    src: tuxUrl,
    credit: 'Larry Ewing · CC BY-SA',
    note: 'الاختبار الكلاسيكي لتسرّب الأنماط في ECB.',
  },
  {
    id: 'alice',
    name: 'Alice',
    meta: 'رسم تينيل',
    src: aliceUrl,
    credit: 'John Tenniel · 1865',
    note: 'خطوط عالية التباين تُظهر انتشار التشفير.',
  },
  {
    id: 'pattern',
    name: 'نقش',
    meta: 'هندسي',
    src: patternUrl,
    credit: 'مولّد داخل المشروع',
    note: 'كتل لونية متطابقة تكشف سلوك الأنماط فوراً.',
  },
];
