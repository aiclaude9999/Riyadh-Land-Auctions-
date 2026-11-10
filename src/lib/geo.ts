/** Geographic classification: Riyadh city / Riyadh region / other Saudi cities. */
import { normalizeArabic, uniq } from './normalize';

export type GeoScope = 'riyadh_city' | 'riyadh_region' | 'other' | 'unknown';
export type GeoFilter = 'riyadh_city' | 'riyadh_region' | 'all';

/** Strip "ال" prefixes & admin words so "محافظة الخرج" == "خرج" == "Al Kharj". */
const ADMIN_WORDS = new Set(['محافظه', 'مدينه', 'منطقه', 'حي', 'مركز', 'governorate', 'province', 'region', 'city', 'district']);
const EN_ARTICLES = new Set(['al', 'el', 'ad', 'ar', 'as', 'az', 'at', 'an']);

export function placeKey(s?: string | null): string {
  return normalizeArabic(s)
    .split(/[\s_-]+/)
    .filter((w) => w && !ADMIN_WORDS.has(w) && !EN_ARTICLES.has(w))
    .map((w) => w.replace(/^ال(?=..)/, ''))
    .join('');
}

const RIYADH_CITY = ['الرياض', 'Riyadh', 'Ar Riyadh', 'RIYADH'];

/** Governorates & main towns of Riyadh Province (outside Riyadh city). */
const RIYADH_REGION_TOWNS = [
  'الخرج', 'Al Kharj', 'Kharj', 'الدرعية', 'Diriyah', 'Ad Diriyah', 'Dir\'iyah', 'المزاحمية', 'Al Muzahimiyah', 'Muzahmiyah', 'Muzahimiyah',
  'الدوادمي', 'Dawadmi', 'Ad Dawadmi', 'المجمعة', 'Majmaah', 'Al Majmaah', 'القويعية', 'Quwaiyah', 'Al Quwaiiyah', 'وادي الدواسر', 'Wadi ad-Dawasir', 'Wadi Al Dawasir',
  'الأفلاج', 'Aflaj', 'Al Aflaj', 'ليلى', 'Layla', 'الزلفي', 'Zulfi', 'Az Zulfi', 'شقراء', 'Shaqra', 'حوطة بني تميم', 'Hotat Bani Tamim', 'عفيف', 'Afif',
  'السليل', 'Sulayyil', 'As Sulayyil', 'ضرماء', 'ضرما', 'Dhurma', 'رماح', 'Rumah', 'ثادق', 'Thadiq', 'حريملاء', 'Huraymila', 'الحريق', 'Al Hariq',
  'الغاط', 'Al Ghat', 'مرات', 'Marat', 'الدلم', 'Ad Dilam', 'Dilam', 'الرين', 'Ar Rayn', 'الحائر', 'العيينة', 'Uyaynah', 'الجبيلة', 'الحوطة',
  'ساجر', 'Sajir', 'نفي', 'البجادية', 'الأرطاوية', 'Artawiyah', 'تمير', 'Tumair', 'جلاجل', 'حوطة سدير', 'روضة سدير', 'الهياثم', 'السيح', 'الحناكية',
];

/** Well-known Riyadh-city districts (used when a listing names a district but not the city). */
const RIYADH_DISTRICTS = [
  'الملقا', 'العليا', 'النرجس', 'الياسمين', 'حطين', 'الصحافة', 'الربيع', 'النخيل', 'الورود', 'الملز', 'السليمانية', 'الروضة', 'النسيم', 'السويدي', 'العريجاء',
  'البديعة', 'الشفا', 'العزيزية', 'الدار البيضاء', 'المونسية', 'قرطبة', 'اشبيلية', 'إشبيلية', 'الرمال', 'المونسيه', 'النظيم', 'الخليج', 'الريان', 'الفيحاء',
  'المروج', 'الغدير', 'العقيق', 'الوادي', 'التعاون', 'المصيف', 'المرسلات', 'الازدهار', 'الندى', 'الفلاح', 'النفل', 'المغرزات', 'الواحة', 'الملك فهد',
  'الملك عبدالله', 'الملك سلمان', 'الملك عبدالعزيز', 'الملك فيصل', 'الفيصلية', 'ديراب', 'عكاظ', 'نمار', 'ظهرة لبن', 'لبن', 'طويق', 'الحزم', 'عرقة',
  'المهدية', 'العارض', 'القيروان', 'بنبان', 'الجنادرية', 'الشرق', 'المعيزيلة', 'الرماية', 'السعادة', 'الجزيرة', 'المنصورة', 'الشميسي', 'البطحاء',
  'المربع', 'الوزارات', 'الصالحية', 'منفوحة', 'الدرعية الجديدة', 'الخزامى', 'السفارات', 'المعذر', 'الرحمانية', 'المحمدية', 'الحمراء', 'غرناطة',
  'اليرموك', 'الندوة', 'الرائد', 'الاندلس', 'النهضة', 'الهدا', 'المناخ', 'السلي', 'الدريهمية', 'العود', 'أم الحمام', 'ام الحمام', 'الشهداء', 'الوشام',
  'المصانع', 'السلام', 'الدفاع', 'الخالدية', 'البرية', 'هيت', 'الدوح', 'الحائر', 'المنار', 'الأمانة', 'جرير', 'الصفا', 'الاسكان', 'الإسكان',
];

const KEYS_CITY = new Set(RIYADH_CITY.map(placeKey));
const KEYS_REGION = new Set(RIYADH_REGION_TOWNS.map(placeKey));
const KEYS_DISTRICT = new Set(RIYADH_DISTRICTS.map(placeKey));
const REGION_NAMES = new Set(['منطقه الرياض', 'الرياض', 'riyadh', 'riyadh region', 'riyadh province', 'ar riyadh'].map(placeKey));

export function isRiyadhCity(name?: string | null): boolean {
  return !!name && KEYS_CITY.has(placeKey(name));
}
export function isRiyadhRegionTown(name?: string | null): boolean {
  return !!name && KEYS_REGION.has(placeKey(name));
}
export function isRiyadhDistrict(name?: string | null): boolean {
  return !!name && KEYS_DISTRICT.has(placeKey(name));
}
export function isRiyadhRegionName(name?: string | null): boolean {
  return !!name && REGION_NAMES.has(placeKey(name));
}

/** Rough bounding box of Riyadh city's urban area. */
export function inRiyadhCityBox(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  return lat >= 24.35 && lat <= 25.15 && lng >= 46.35 && lng <= 47.15;
}

const KNOWN_CITIES = [
  'الرياض', 'جدة', 'جده', 'مكة', 'مكه', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الأحساء', 'الاحساء', 'الهفوف', 'القطيف', 'الجبيل', 'تبوك', 'أبها', 'ابها',
  'خميس مشيط', 'الطائف', 'بريدة', 'عنيزة', 'حائل', 'جازان', 'جيزان', 'نجران', 'الباحة', 'عرعر', 'سكاكا', 'الجوف', 'ينبع', 'رابغ', 'القصيم', 'حفر الباطن', 'الرس',
  'بيشة', 'القنفذة', 'الليث', 'محايل', 'صبيا', 'أملج', 'الوجه', 'ضباء', 'العلا', 'شرورة', 'رفحاء', 'طريف', 'القريات', 'الخفجي', 'رأس تنورة', 'بقيق',
  ...RIYADH_REGION_TOWNS.filter((t) => /[؀-ۿ]/.test(t)),
];

/** Find city names mentioned in free text (titles, addresses). Only returns names actually present. */
export function citiesInText(text?: string | null): string[] {
  if (!text) return [];
  const n = ' ' + normalizeArabic(text) + ' ';
  const found: string[] = [];
  for (const c of KNOWN_CITIES) {
    const k = normalizeArabic(c);
    if (n.includes(' ' + k + ' ') || n.includes(' ' + k.replace(/^ال/, '') + ' ')) found.push(c);
  }
  return uniq(found);
}

export function districtsInText(text?: string | null): string[] {
  if (!text) return [];
  const n = ' ' + normalizeArabic(text) + ' ';
  return uniq(RIYADH_DISTRICTS.filter((d) => n.includes(' ' + normalizeArabic(d) + ' ')));
}

export interface GeoInput {
  cities?: (string | null | undefined)[];
  regions?: (string | null | undefined)[];
  districts?: (string | null | undefined)[];
  lat?: number | null;
  lng?: number | null;
}

export interface GeoResult {
  scope: GeoScope;
  hasRiyadhCity: boolean;
  hasRiyadhRegion: boolean; // includes Riyadh city
  isMultiLocation: boolean;
}

/**
 * Classify a listing by the location of its asset(s).
 * - riyadh_city: at least one asset in Riyadh city
 * - riyadh_region: at least one asset in Riyadh Province (but not the city)
 * - other: located only elsewhere
 * - unknown: no location data
 */
export function classifyGeo(inp: GeoInput): GeoResult {
  const cities = uniq(inp.cities ?? []);
  const regions = uniq(inp.regions ?? []);
  const districts = uniq(inp.districts ?? []);
  let city = cities.some(isRiyadhCity);
  let region = city || cities.some(isRiyadhRegionTown);
  const regionIsRiyadh = regions.some(isRiyadhRegionName);

  if (!city && regionIsRiyadh && cities.length === 0 && districts.some(isRiyadhDistrict)) city = true;
  if (!city && cities.length === 0 && districts.some(isRiyadhDistrict) && !regions.length) city = true;
  if (!city && cities.length === 0 && inRiyadhCityBox(inp.lat, inp.lng)) city = true;
  region = region || city || regionIsRiyadh;

  const cityKeys = new Set(cities.map(placeKey));
  const isMultiLocation = cityKeys.size > 1;
  const hasAny = cities.length > 0 || regions.length > 0 || districts.length > 0 || (inp.lat != null && inp.lng != null);
  const scope: GeoScope = city ? 'riyadh_city' : region ? 'riyadh_region' : hasAny ? 'other' : 'unknown';
  return { scope, hasRiyadhCity: city, hasRiyadhRegion: region, isMultiLocation };
}
