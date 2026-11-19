export const APP_NAME = 'سِتر';
export const APP_TAGLINE = 'مختبر تشفير الصور';

export const KEY_SIZES = [128, 256];

export const MAX_SIDE = 1200;
export const MAX_FILE_MB = 15;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const PBKDF2_ITERATIONS = 150_000;
export const PASSPHRASE_SALT = 'Sitr-ImageCipher-v1';

export const MODES = [
  {
    id: 'ECB',
    name: 'الوضع الإلكتروني',
    latin: 'Electronic Codebook',
    hint: 'كل كتلة بمفردها',
    tag: 'يكشف الأنماط',
    description: 'تشفير مستقل لكل كتلة 16 بايت. الأنماط البصرية تبقى ظاهرة بوضوح.',
  },
  {
    id: 'CBC',
    name: 'ربط الكتل',
    latin: 'Cipher Block Chaining',
    hint: 'سلسلة عبر IV',
    description: 'كل كتلة تعتمد على سابقتها عبر متجه تهيئة عشوائي، فيتلاشى النمط.',
  },
  {
    id: 'CTR',
    name: 'وضع العدّاد',
    latin: 'Counter Mode',
    hint: 'دفق متوازٍ',
    description: 'يحوّل AES إلى تشفير تدفقي عبر عدّاد متزايد، دون حشو للبيانات.',
  },
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((mode) => [mode.id, mode]));

export const MODE_CODES = { ECB: 0, CBC: 1, CTR: 2 };
export const MODE_FROM_CODE = { 0: 'ECB', 1: 'CBC', 2: 'CTR' };

// Bytes appended to the RGB stream before encryption: "SITRIMG" magic,
// format version, mode/key metadata, dimensions and RGB length.
export const PAYLOAD_HEADER_SIZE = 24;
export const AES_BLOCK_BYTES = 16;

export const MODE_INSIGHTS = {
  ECB: {
    title: 'لماذا يظهر شكل الصورة في ECB؟',
    body: 'كل كتلة 16 بايت تُشفَّر بمعزل عن غيرها وبنفس المفتاح. البكسلات المتشابهة تُنتج كتلاً متشابهة، فتبقى الحدود والمساحات الكبيرة قابلة للتمييز — وهذا تسرّب بنيوي معروف، وليس خللاً في التنفيذ. لهذا لا يُنصح بـ ECB للبيانات المرئية.',
    formula: 'Cᵢ = AES(Pᵢ)',
    tone: 'caution',
    badge: 'نمط محفوظ',
  },
  CBC: {
    title: 'كيف يزيل CBC البصمة البصرية؟',
    body: 'قبل التشفير، تُدمج كل كتلة (XOR) مع الكتلة المشفّرة السابقة، وتبدأ السلسلة بـ IV عشوائي. النتيجة أن تكرار البكسلات لا يعني تكرار الكتل، فتختفي الأنماط تماماً. فك التشفير يعكس السلسلة باستخدام المفتاح نفسه و IV.',
    formula: 'Cᵢ = AES(Pᵢ ⊕ Cᵢ₋₁)',
    tone: 'secure',
    badge: 'انتشار كامل',
  },
  CTR: {
    title: 'لماذا يعمل CTR كتشفير تدفقي؟',
    body: 'يُشفَّر عدّاد متزايد (بدءاً من IV/Nonce) لإنتاج تدفق مفاتيح، ثم يُدمج XOR مع البيانات. لا يحتاج حشو لأن الطول محفوظ، ويمكن تنفيذ الكتل على التوازي. شرط الأمان الحاسم: عدم إعادة استخدام القيمة الابتدائية مع المفتاح نفسه.',
    formula: 'Cᵢ = Pᵢ ⊕ AES(IV + i)',
    tone: 'secure',
    badge: 'تدفق متوازٍ',
  },
};

export const STORAGE_NEVER = 'لا تُرسل الصور أو المفاتيح إلى أي خادم.';
