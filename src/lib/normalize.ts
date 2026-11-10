/** Text / category / status normalisation shared by every connector. */

export type Category = 'real_estate' | 'vehicle' | 'equipment' | 'scrap' | 'collectible' | 'other';
export type Status = 'upcoming' | 'live' | 'ended';

export const CATEGORY_LABELS: Record<Category, string> = {
  real_estate: 'عقار',
  vehicle: 'سيارات',
  equipment: 'معدات',
  scrap: 'سكراب',
  collectible: 'مقتنيات',
  other: 'أخرى',
};

export const STATUS_LABELS: Record<Status, string> = { upcoming: 'قادم', live: 'جاري', ended: 'منتهي' };

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g; // tashkeel + tatweel

/** Unify Arabic spelling variants so the same text compares equal across sources. */
export function normalizeArabic(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TITLE_STOPWORDS = new Set(['مزاد', 'مزادات', 'علني', 'الكتروني', 'الالكتروني', 'هجين', 'auction', 'the', 'في', 'على', 'من', 'و', 'ل']);

/** Normalised title used for de-duplication (drops generic words like "مزاد"). */
export function normalizeTitle(title?: string | null): string {
  return normalizeArabic(title)
    .split(' ')
    .filter((w) => w && !TITLE_STOPWORDS.has(w))
    .join(' ');
}

const ORG_STOPWORDS = new Set(['شركه', 'مؤسسه', 'للمزادات', 'العقاريه', 'العقاري', 'للتسويق', 'للتقييم', 'company', 'co', 'ltd', 'est']);
export function normalizeOrganizer(name?: string | null): string {
  return normalizeArabic(name)
    .split(' ')
    .filter((w) => w && !ORG_STOPWORDS.has(w))
    .join(' ');
}

const CATEGORY_RULES: [Category, RegExp][] = [
  ['scrap', /(سكراب|خرده|خردة|scrap|تالف|رجيع)/i],
  ['real_estate', /(real.?estate|عقار|عقاري|ارض|أرض|اراضي|أراضي|فيلا|فلل|شقه|شقة|عماره|عمارة|مخطط|استراحه|استراحة|مبنى|مباني|مستودع|محلات|land|villa)/i],
  ['equipment', /(equipment|machinery|معدات|معده|آليات|اليات|مولد|رافعه|رافعة|حفار|شيول|مكائن|مكينه|أجهزه|اجهزه|أثاث|اثاث)/i],
  ['vehicle', /(vehicle|car(s)?\b|سيار|مركب|شاحن|باص|دباب|ونيت|vehicles)/i],
  ['collectible', /(collect|مقتني|تحف|ساعات|مجوهرات|لوح|لوحات|ارقام مميزه|أرقام مميزة|خيول|خيل|إبل|ابل|صقور|نوادر)/i],
];

/** Map a source-specific category hint (and/or a title) to our fixed set. */
export function mapCategory(...hints: (string | null | undefined)[]): Category {
  for (const h of hints) {
    if (!h) continue;
    for (const [cat, re] of CATEGORY_RULES) if (re.test(h)) return cat;
  }
  return 'other';
}

/** Derive status from dates when the source does not provide one. */
export function statusFromDates(startAt: Date | null, endAt: Date | null, now = new Date()): Status | null {
  if (startAt && now < startAt) return 'upcoming';
  if (endAt && now >= endAt) return 'ended';
  if (startAt && (!endAt || now < endAt)) return 'live';
  return null;
}

/** Parse money values like "12,500.00 ر.س" or numbers; zero / negative -> null (= not available). */
export function parseMoney(v: unknown): number | null {
  if (v == null || v === '' || v === false) return null;
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  const s = String(v).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

export function cleanText(s?: string | null): string | null {
  if (s == null) return null;
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t ? t : null;
}

export function uniq<T>(arr: (T | null | undefined)[]): T[] {
  return [...new Set(arr.filter((x): x is T => x != null && x !== ''))];
}
