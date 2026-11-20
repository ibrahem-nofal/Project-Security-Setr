import tuxUrl from '../assets/presets/tux.png';
import aliceUrl from '../assets/presets/alice.png';
import gridUrl from '../assets/presets/grid.svg';
import gradientUrl from '../assets/presets/gradient.svg';
import documentUrl from '../assets/presets/document.svg';

export const PRESETS = [
  {
    id: 'tux',
    name: 'Tux',
    meta: 'بنغوين لينكس',
    src: tuxUrl,
    credit: 'Larry Ewing · CC BY-SA',
    note: 'مثالي لإظهار تسرّب الأنماط في نمط AES-ECB.',
  },
  {
    id: 'alice',
    name: 'Alice',
    meta: 'رسم تينيل',
    src: aliceUrl,
    credit: 'John Tenniel · 1865',
    note: 'صورة اختبار كلاسيكية عالية التباين في أبحاث التشفير.',
  },
  {
    id: 'grid',
    name: 'شبكة',
    meta: 'هندسية',
    src: gridUrl,
    credit: 'مولّد داخل المشروع',
    note: 'نمط هندسي متكرر عالي التباين يكشف بقاء البنية في ECB.',
  },
  {
    id: 'gradient',
    name: 'تدرج',
    meta: 'ملون',
    src: gradientUrl,
    credit: 'مولّد داخل المشروع',
    note: 'تدرجات لونية متصلة لاختبار استمرارية الألوان تحت التشفير.',
  },
  {
    id: 'document',
    name: 'وثيقة',
    meta: 'نصية',
    src: documentUrl,
    credit: 'مولّد داخل المشروع',
    note: 'سطور نصية ومحاذاة وثيقة تكشف قابلية القراءة المتبقية في ECB.',
  },
];
