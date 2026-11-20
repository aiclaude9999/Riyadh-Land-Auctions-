/**
 * UI strings in English and Arabic. Components get them with `useT()` (components/LocaleProvider.tsx).
 * Layout uses logical Tailwind classes (ms-/me-/ps-/pe-/start-/end-) so Arabic (RTL) needs no rewrites.
 */
export type Locale = 'en' | 'ar';
export const LOCALES: Locale[] = ['en', 'ar'];
export const DIR: Record<Locale, 'ltr' | 'rtl'> = { en: 'ltr', ar: 'rtl' };
export const LOCALE_COOKIE = 'lang';

export interface CarStepInfo {
  type: string;
  modifier?: string;
  exit?: number;
  road: string;
}

const EN_DIR: Record<string, string> = { left: 'left', right: 'right', 'slight left': 'slightly left', 'slight right': 'slightly right', 'sharp left': 'sharp left', 'sharp right': 'sharp right' };
const AR_DIR: Record<string, string> = { left: 'يسارًا', right: 'يمينًا', 'slight left': 'قليلًا إلى اليسار', 'slight right': 'قليلًا إلى اليمين', 'sharp left': 'بحدّة إلى اليسار', 'sharp right': 'بحدّة إلى اليمين' };
/** Arabic counted noun for minutes: 1 دقيقة واحدة، 2 دقيقتان، 3–10 دقائق، 11+ دقيقة. */
export function arMin(v: number | string): string {
  const n = Math.round(Number(v));
  if (n === 1) return 'دقيقة واحدة';
  if (n === 2) return 'دقيقتان';
  if (n >= 3 && n <= 10) return `${n} دقائق`;
  return `${n} دقيقة`;
}

const side = (m?: string) => (m?.includes('left') ? 'left' : m?.includes('right') ? 'right' : '');

export const en = {
  langName: 'English',
  accessLabel: 'To the station:',
  tasteLabel: 'Taste',
  tasteHint: 'Tap once = likes, twice = avoids, three times = clear.',
  styleFair: 'Fairest',
  styleQuick: 'Quickest',
  styleBest: 'Best match',
  styleFairHelp: 'Nobody travels too long.',
  styleQuickHelp: 'Least travel for the group in total.',
  styleBestHelp: 'Food the group likes, still a fair trip.',
  fits: (n: number, of: number) => `Fits ${n} of ${of}`,
  placeScore: (s: number) => `Place score ${s}`,
  closedAtArrival: 'Probably closed when you arrive (listed opening hours).',
  openAtArrival: 'Open when you arrive (listed hours).',
  matchNote: 'Place score = taste fit, loved food, metro access and your favourites. No free data on price, parking or family sections.',
  longWalkWarn: (names: string) => `${names}: more than 20 min on foot to the station. In People, set “To the station” to Car / taxi for a quicker trip.`,
  accessWalk: 'Walk',
  accessCar: 'Car / taxi',
  allVenuesLayer: 'All cafés & restaurants',
  loadingVenues: 'Loading places…',
  useAsMeetingPlace: 'Use as meeting place',
  pickNeedsPeople: 'Give everyone a starting point first.',
  yourPick: 'Your pick',
  showRoute: 'Show route on map',
  showEveryone: 'Show everyone',
  stepHint: 'Tap a step to zoom the map to it.',
  routeOf: (name: string) => `${name}'s route`,
  walkingRoute: 'walking',
  shareTitle: 'Plan together',
  shareIntro: 'Share a link: each friend adds their own starting point, then everyone votes on the top 3.',
  shareButton: 'Share with friends',
  sharing: 'Creating link…',
  shareLink: 'Group link',
  copy: 'Copy',
  copied: 'Copied ✓',
  whatsapp: 'WhatsApp',
  whatsappText: (link: string) => `Where should we meet? Add your starting point here: ${link}`,
  organiser: 'You are the organiser',
  member: 'You joined this group',
  visitor: 'You are viewing this group',
  addMe: 'Add me',
  groupExpires: (date: string) => `Shared until ${date}, then deleted.`,
  privacyNote: 'Anyone with the link can see the names and starting points in this group.',
  onlyOrganiserSearches: 'Only the organiser can run the search. The results appear here by themselves.',
  readOnlyPerson: 'Only this person or the organiser can change this.',
  vote: 'Vote',
  voted: 'Your vote',
  votesCount: (n: number) => (n === 1 ? '1 vote' : `${n} votes`),
  mostVotes: 'Most votes',
  leaveGroup: 'Stop sharing on this device',
  groupMissing: 'This group link has expired or does not exist.',
  localOnlyNote: 'The app is not online yet, so this link only works on this computer.',
  syncError: 'Could not reach the group. Retrying…',
  switchTo: 'العربية',
  maxLabel: 'longest',
  distance: (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`),
  appTitle: 'Riyadh Meetup Point',
  appTagline: 'Find the fairest café or restaurant for your group.',
  people: 'People',
  peopleCount: (n: number, max: number) => `${n} of ${max}`,
  addPerson: 'Add person',
  removePerson: 'Remove',
  namePlaceholder: (n: number) => `Person ${n}`,
  nameLabel: 'Name',
  modeLabel: 'Travel mode',
  car: 'Car',
  metro: 'Metro',
  locationLabel: 'Starting point',
  searchPlaceholder: 'Search an address or place',
  neighbourhoodPlaceholder: 'Neighbourhood, e.g. Al Narjis / النرجس',
  districtCentre: (name: string) => `${name} (centre)`,
  pinnedIn: (name: string) => `Pinned in ${name}`,
  refineBanner: (who: string, area: string) => `Tap ${who}'s exact spot in ${area}, or press Esc to keep the centre`,
  districtCredit: 'Neighbourhoods © Saudi Post address map (via homaily, GPL-2.0)',
  pickOnMap: 'Pick on map',
  picking: 'Click the map…',
  pinnedOnMap: 'Pinned on map',
  clearLocation: 'Clear',
  missingLocation: 'Needs a starting point',
  outsideRiyadh: 'This point is outside Riyadh — results may be poor.',
  nearestStation: (name: string, km: string) => `Nearest metro: ${name} (${km} km straight line)`,
  pickBanner: (name: string) => `Click the map to set ${name}'s starting point`,
  cancel: 'Cancel',
  dragHint: 'Tip: drag a pin to fine-tune it.',
  readyCount: (ready: number, total: number) => `${ready} of ${total} people have a starting point`,
  tabPeople: 'People',
  tabResults: 'Results',
  tabPrefs: 'Preferences',
  prefsIntro: 'Saved only in this browser. Used to rank places for your group.',
  likesLabel: 'We like',
  avoidsLabel: 'Skip places that only serve',
  favouritesLabel: 'Favourite places',
  hiddenLabel: 'Hidden places',
  noneYet: 'None yet — use ☆ or “Hide” on a result.',
  remove: 'Remove',
  unhide: 'Show again',
  clearAll: 'Clear all preferences',
  groups: { coffee: 'Coffee', arabic: 'Arabic & Saudi', italian: 'Pizza & Italian', burger: 'Burgers & fast food', asian: 'Asian & Indian', dessert: 'Desserts', sandwich: 'Breakfast & sandwiches', grill: 'Grill & seafood' } as Record<string, string>,
  prefsNote: 'About 9 in 10 places say what food they serve; food preferences cannot help the rest.',
  favourite: 'Favourite',
  unfavourite: 'Unfavourite',
  hide: 'Hide',
  likedWhy: (groups: string) => `Serves food you like: ${groups} (−2 min).`,
  favouriteWhy: 'One of your favourite places (−3 min).',
  reviews: 'Reviews on Google Maps',
  directions: 'Directions',
  tripTitle: 'Trip details',
  showSteps: 'Steps',
  hideSteps: 'Hide steps',
  loadingRoute: 'Loading route…',
  routeFailed: 'Could not load the car route. Use “Directions”.',
  carSummary: (km: string, min: string) => `${km} km · about ${min} min without traffic`,
  stepWalkToStation: (min: string, station: string) => `Walk ${min} min to ${station} station`,
  stepWait: (min: string) => `Wait about ${min} min for the train`,
  stepDriveToStation: (min: string, station: string) => `Get a ride (car/taxi) to ${station} station · about ${min} min`,
  stepRide: (line: string, toward: string, stops: number) => `Take the ${line} toward ${toward} · ${stops} stop${stops === 1 ? '' : 's'}`,
  stepGetOff: (station: string) => `Get off at ${station}`,
  stepTransfer: (station: string, line: string) => `Change at ${station} to the ${line} (about 5 min)`,
  stepWalkToVenue: (min: string) => `Walk ${min} min to the meeting place`,
  stepWalkAll: (min: string) => `Walk ${min} min to the meeting place`,
  venueTypeLabel: 'Place',
  venueTypes: { cafe: 'Café', restaurant: 'Restaurant', both: 'Both' } as Record<'cafe' | 'restaurant' | 'both', string>,
  departLabel: 'Leaving',
  departNow: 'Now',
  departLater: 'Later',
  dayToday: 'Today',
  dayTomorrow: 'Tomorrow',
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  timeLabel: 'Time',
  trafficLevels: { light: 'light traffic', moderate: 'moderate traffic', heavy: 'heavy traffic' } as Record<string, string>,
  filtersLabel: 'Filters',
  nearMetroOnly: 'Near a metro station',
  anyFood: 'Any food',
  typicalTraffic: 'typical traffic',
  trafficNote: (when: string, factor: string) => `Car times include typical Riyadh traffic for ${when} (×${factor} vs an empty road, from TomTom 2025 averages), not live traffic.`,
  prayerWarn: (name: string, time: string) => `You'd arrive around ${name} prayer (${time}). Some places pause service for about 20–30 min.`,
  metroWarn: (names: string) => `Metro may not be running for ${names} at this time (Sat–Thu 5:30–24:00, Fri 10:00–24:00; Ramadan differs). Check the Darb app.`,
  zoneToggle: 'Show where everyone is within',
  zoneLegend: 'Green area: nobody travels longer than this (approximate).',
  prayers: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' } as Record<string, string>,
  find: 'Find meeting point',
  finding: 'Finding…',
  needLocations: 'Give everyone a starting point first.',
  staleResults: 'You changed the inputs. Press “Find meeting point” again to update.',
  noResults: 'No places found for this group. Try “Both”, or move the pins.',
  requestFailed: 'Something went wrong. Try again in a minute.',
  topPlaces: (n: number) => `Top ${n} places`,
  longestTrip: (min: string, who: string) => `Longest trip ${min} min (${who})`,
  fairnessWhy: (min: string, who: string) => `Fairest found: nobody travels more than ${min} min — ${who} has the longest trip.`,
  spreadWhy: (min: string) => `Trips differ by only ${min} min.`,
  stationWhy: (m: number, name: string, bonus: number) => bonus ? `${m} m from ${name} metro (−${bonus} min bonus).` : `${m} m from ${name} metro.`,
  metroRoute: (from: string, to: string, transfers: number) => `${from} → ${to}${transfers ? `, ${transfers} change${transfers > 1 ? 's' : ''}` : ''}`,
  walkOnly: 'walk the whole way',
  walking: (min: string) => `${min} min on foot`,
  estimated: 'est.',
  live: 'live',
  noTraffic: 'no traffic',
  estimatedHelp: 'est. = estimated by this app, not from a routing service.',
  sourceFree: 'Free data: places from Overture Maps and OpenStreetMap (no ratings); car times from the road network plus typical traffic, not live.',
  sourceGoogle: 'Google data: rated places, car times with live traffic, metro from Google transit.',
  carEstimated: 'Car routing service did not answer — car times are rough estimates.',
  metroEstimatedNote: 'Metro times use the app’s estimate: walk to the nearest station at 5 km/h, 4 min wait, 1.5 min per station, 5 min per change. Walking counts 1.5× for the heat.',
  minutes: (m: number) => `${Math.round(m)} min`,
  openInMaps: 'Open in Google Maps',
  metroLayer: 'Metro lines',
  searchNoKey: 'Address search is off: GOOGLE_MAPS_API_KEY is not set on the server. Use “Pick on map”.',
  searchError: 'Search failed. Try again or use “Pick on map”.',
  noMatches: 'No matches',
  metroAttribution: 'Metro data © OpenStreetMap contributors (ODbL)',
  mapCredits: 'Places © Overture Maps Foundation, OpenStreetMap · Metro © OpenStreetMap (ODbL) · Neighbourhoods © Saudi Post via homaily (GPL-2.0)',
  lines: 'Lines',
  interchange: 'Interchange',
  lineNames: { '1': 'Blue Line', '2': 'Red Line', '3': 'Orange Line', '4': 'Yellow Line', '5': 'Green Line', '6': 'Purple Line' } as Record<string, string>,
  arriveStep: 'Arrive at the meeting place',
  carStep(s: CarStepInfo): string {
    const onto = s.road ? ` onto ${s.road}` : '';
    const dir = EN_DIR[s.modifier ?? ''] ?? '';
    const sd = side(s.modifier);
    switch (s.type) {
      case 'depart':
        return s.road ? `Start on ${s.road}` : 'Start';
      case 'arrive':
        return 'Arrive at the meeting place';
      case 'roundabout':
      case 'rotary':
        return `At the roundabout take ${s.exit ? `exit ${s.exit}` : 'the exit'}${onto}`;
      case 'on ramp':
        return `Take the ramp${sd ? ` on the ${sd}` : ''}${onto}`;
      case 'off ramp':
        return `Take the exit${sd ? ` on the ${sd}` : ''}${onto}`;
      case 'fork':
        return `Keep ${sd || 'straight'} at the fork${onto}`;
      case 'merge':
        return `Merge${onto}`;
      case 'end of road':
        return `At the end of the road turn ${dir || 'as signed'}${onto}`;
      case 'continue':
      case 'new name':
        return `Continue${onto}`;
      default:
        if (s.modifier === 'straight') return `Go straight${onto}`;
        if (s.modifier === 'uturn') return `Make a U-turn${onto}`;
        return `Turn ${dir || 'ahead'}${onto}`;
    }
  },
};

export type Strings = typeof en;

export const ar: Strings = {
  langName: 'العربية',
  accessLabel: 'إلى المحطة:',
  tasteLabel: 'الذوق',
  tasteHint: 'المسة الأولى = يحب، الثانية = يتجنب، الثالثة = تمسح.',
  styleFair: 'الأعدل',
  styleQuick: 'الأسرع',
  styleBest: 'الأنسب',
  styleFairHelp: 'لا يطول مشوار أحد.',
  styleQuickHelp: 'أقل وقت تنقّل للمجموعة كلها.',
  styleBestHelp: 'طعام تحبه المجموعة، ومشوار عادل.',
  fits: (n, of) => `يناسب ${n} من ${of}`,
  placeScore: (s) => `تقييم المكان ${s}`,
  closedAtArrival: 'قد يكون مغلقًا عند وصولكم (بحسب أوقات العمل المسجلة).',
  openAtArrival: 'مفتوح عند وصولكم (بحسب الأوقات المسجلة).',
  matchNote: 'تقييم المكان = ملاءمة الذوق، والطعام المحبوب، وسهولة الوصول بالمترو، ومفضلاتكم. لا تتوفر بيانات مجانية عن الأسعار أو المواقف أو أقسام العائلات.',
  longWalkWarn: (names) => `${names}: أكثر من 20 دقيقة مشيًا إلى المحطة. اختر في «الأشخاص» الذهاب إلى المحطة بسيارة أو أجرة لرحلة أسرع.`,
  accessWalk: 'مشيًا',
  accessCar: 'سيارة / أجرة',
  allVenuesLayer: 'كل المقاهي والمطاعم',
  loadingVenues: 'تُحمَّل الأماكن…',
  useAsMeetingPlace: 'اجعله مكان اللقاء',
  pickNeedsPeople: 'حدّد نقطة انطلاق كل شخص أولًا.',
  yourPick: 'اختيارك',
  showRoute: 'اعرض المسار على الخريطة',
  showEveryone: 'اعرض الجميع',
  stepHint: 'المس خطوة لتقترب الخريطة منها.',
  routeOf: (name) => `مسار ${name}`,
  walkingRoute: 'مشيًا',
  shareTitle: 'خطّطوا معًا',
  shareIntro: 'شارك رابطًا يضيف فيه كل صديق نقطة انطلاقه، ثم يصوّت الجميع على أفضل ثلاثة أماكن.',
  shareButton: 'شارك أصحابك',
  sharing: 'يُنشأ الرابط…',
  shareLink: 'رابط المجموعة',
  copy: 'انسخ',
  copied: 'نُسخ ✓',
  whatsapp: 'واتساب',
  whatsappText: (link) => `وين نلتقي؟ أضف نقطة انطلاقك من هنا: ${link}`,
  organiser: 'أنت منظّم المجموعة',
  member: 'انضممت إلى هذه المجموعة',
  visitor: 'تشاهد هذه المجموعة',
  addMe: 'أضفني',
  groupExpires: (date) => `تبقى المشاركة حتى ${date} ثم تُحذف.`,
  privacyNote: 'يرى كل من يملك الرابط الأسماء ونقاط الانطلاق في هذه المجموعة.',
  onlyOrganiserSearches: 'لا يبحث إلا المنظّم، وتظهر النتائج هنا تلقائيًا.',
  readOnlyPerson: 'لا يغيّر هذا إلا صاحبه أو المنظّم.',
  vote: 'صوّت',
  voted: 'صوتك',
  votesCount: (n) => (n === 1 ? 'صوت واحد' : n === 2 ? 'صوتان' : n <= 10 ? `${n} أصوات` : `${n} صوتًا`),
  mostVotes: 'الأكثر أصواتًا',
  leaveGroup: 'أوقف المشاركة على هذا الجهاز',
  groupMissing: 'انتهت صلاحية رابط المجموعة أو لم يعد موجودًا.',
  localOnlyNote: 'التطبيق ليس على الإنترنت بعد، فلا يعمل هذا الرابط إلا على هذا الحاسوب.',
  syncError: 'تعذّر الوصول إلى المجموعة. نعيد المحاولة…',
  switchTo: 'English',
  maxLabel: 'أطول مشوار',
  distance: (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} كم` : `${Math.round(m / 10) * 10} م`),
  appTitle: 'ملتقى الرياض',
  appTagline: 'اعثر على أعدل مقهى أو مطعم يلتقي فيه أصحابك.',
  people: 'الأشخاص',
  peopleCount: (n, max) => `${n} من ${max}`,
  addPerson: 'أضف شخصًا',
  removePerson: 'احذف',
  namePlaceholder: (n) => `الشخص ${n}`,
  nameLabel: 'الاسم',
  modeLabel: 'وسيلة التنقل',
  car: 'سيارة',
  metro: 'مترو',
  locationLabel: 'نقطة الانطلاق',
  searchPlaceholder: 'ابحث عن عنوان أو مكان',
  neighbourhoodPlaceholder: 'الحي، مثل: النرجس / Al Narjis',
  districtCentre: (name) => `وسط حي ${name}`,
  pinnedIn: (name) => `موقع محدد في حي ${name}`,
  refineBanner: (who, area) => `المس موقع ${who} الدقيق في حي ${area}، أو اضغط Esc لتبقى نقطة وسط الحي`,
  districtCredit: 'الأحياء © خريطة العناوين الوطنية من البريد السعودي (عبر homaily، رخصة GPL-2.0)',
  pickOnMap: 'حدّد على الخريطة',
  picking: 'انقر الخريطة…',
  pinnedOnMap: 'موقع محدد على الخريطة',
  clearLocation: 'امسح',
  missingLocation: 'لم تُحدَّد نقطة الانطلاق بعد',
  outsideRiyadh: 'هذه النقطة خارج الرياض، وقد لا تصلح النتائج.',
  nearestStation: (name, km) => `أقرب محطة مترو: ${name} (${km} كم في خط مستقيم)`,
  pickBanner: (name) => `انقر الخريطة لتحدد نقطة انطلاق ${name}`,
  cancel: 'إلغاء',
  dragHint: 'تلميح: اسحب الدبوس لتضبط الموقع.',
  readyCount: (ready, total) => `حُدِّدت نقطة الانطلاق لـ ${ready} من ${total}`,
  tabPeople: 'الأشخاص',
  tabResults: 'النتائج',
  tabPrefs: 'التفضيلات',
  prefsIntro: 'تُحفظ في هذا المتصفح وحده، وتعين على ترتيب الأماكن لمجموعتك.',
  likesLabel: 'نحب',
  avoidsLabel: 'استبعد الأماكن التي لا تقدّم إلا',
  favouritesLabel: 'الأماكن المفضّلة',
  hiddenLabel: 'الأماكن المخفية',
  noneYet: 'لا شيء بعد. استعمل ☆ أو «أخفِ» في النتائج.',
  remove: 'احذف',
  unhide: 'أظهِر',
  clearAll: 'امسح التفضيلات كلها',
  groups: { coffee: 'القهوة', arabic: 'المأكولات العربية والسعودية', italian: 'البيتزا والإيطالي', burger: 'البرغر والوجبات السريعة', asian: 'الآسيوي والهندي', dessert: 'الحلويات', sandwich: 'الفطور والساندويتشات', grill: 'المشويات والمأكولات البحرية' },
  prefsNote: 'يذكر نحو تسعة أماكن من كل عشرة نوعَ طعامها، ولا تنفع تفضيلات الطعام مع الباقي.',
  favourite: 'أضف للمفضلة',
  unfavourite: 'أزل من المفضلة',
  hide: 'أخفِ',
  likedWhy: (groups) => `يقدّم طعامًا تحبونه: ${groups} (−2 دقيقة).`,
  favouriteWhy: 'من أماكنكم المفضلة (−3 دقائق).',
  reviews: 'التقييمات في خرائط Google',
  directions: 'الاتجاهات',
  tripTitle: 'تفاصيل الرحلة',
  showSteps: 'الخطوات',
  hideSteps: 'أخفِ الخطوات',
  loadingRoute: 'يُحمَّل المسار…',
  routeFailed: 'تعذّر تحميل مسار السيارة. استعمل زر «الاتجاهات».',
  carSummary: (km, min) => `${km} كم · نحو ${arMin(min)} بلا زحام`,
  stepWalkToStation: (min, station) => `امشِ ${arMin(min)} إلى محطة ${station}`,
  stepWait: (min) => `انتظر القطار نحو ${arMin(min)}`,
  stepDriveToStation: (min, station) => `توجّه بالسيارة أو سيارة الأجرة إلى محطة ${station} · نحو ${arMin(min)}`,
  stepRide: (line, toward, stops) => `اركب ${line} باتجاه ${toward} · ${stops} ${stops === 1 ? 'محطة' : stops === 2 ? 'محطتان' : stops <= 10 ? 'محطات' : 'محطة'}`,
  stepGetOff: (station) => `انزل في محطة ${station}`,
  stepTransfer: (station, line) => `بدّل القطار في ${station} إلى ${line} (نحو 5 دقائق)`,
  stepWalkToVenue: (min) => `امشِ ${arMin(min)} إلى مكان اللقاء`,
  stepWalkAll: (min) => `امشِ ${arMin(min)} إلى مكان اللقاء`,
  venueTypeLabel: 'المكان',
  venueTypes: { cafe: 'مقهى', restaurant: 'مطعم', both: 'كلاهما' },
  departLabel: 'الانطلاق',
  departNow: 'الآن',
  departLater: 'لاحقًا',
  dayToday: 'اليوم',
  dayTomorrow: 'غدًا',
  weekdays: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  timeLabel: 'الوقت',
  trafficLevels: { light: 'زحام خفيف', moderate: 'زحام متوسط', heavy: 'زحام شديد' },
  filtersLabel: 'التصفية',
  nearMetroOnly: 'قرب محطة مترو',
  anyFood: 'أي طعام',
  typicalTraffic: 'زحام معتاد',
  trafficNote: (when, factor) => `تشمل أوقات السيارة الزحام المعتاد في الرياض يوم ${when} (×${factor} من وقت الطريق الخالي، بحسب متوسطات TomTom لعام 2025)، لا الزحام الحي.`,
  prayerWarn: (name, time) => `ستصلون قرب صلاة ${name} (${time})، وقد يوقف بعض الأماكن الخدمة نحو 20–30 دقيقة.`,
  metroWarn: (names) => `قد لا يعمل المترو لـ ${names} في هذا الوقت (من السبت إلى الخميس 5:30–24:00، والجمعة 10:00–24:00، ويختلف في رمضان). تحقق من تطبيق «درب».`,
  zoneToggle: 'أظهِر المنطقة التي لا يتجاوز فيها أحدٌ',
  zoneLegend: 'المنطقة الخضراء: لا يطول فيها مشوار أحد عن هذه المدة (تقريبًا).',
  prayers: { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
  find: 'اعثر على مكان اللقاء',
  finding: 'جارٍ البحث…',
  needLocations: 'حدّد نقطة انطلاق كل شخص أولًا.',
  staleResults: 'غيّرت المدخلات. اضغط «اعثر على مكان اللقاء» مرة أخرى لتحديث النتائج.',
  noResults: 'لم نجد مكانًا لهذه المجموعة. جرّب «كلاهما» أو حرّك الدبابيس.',
  requestFailed: 'حدث خطأ. أعد المحاولة بعد دقيقة.',
  topPlaces: (n) => `أفضل ${n} أماكن`,
  longestTrip: (min, who) => `أطول مشوار ${arMin(min)} (${who})`,
  fairnessWhy: (min, who) => `أعدل خيار: لا يزيد مشوار أحد على ${arMin(min)}، وأطولها مشوار ${who}.`,
  spreadWhy: (min) => `لا يزيد الفرق بين المشاوير على ${arMin(min)}.`,
  stationWhy: (m, name, bonus) => (bonus ? `يبعد ${m} م عن محطة ${name} (خُصمت ${arMin(bonus)}).` : `يبعد ${m} م عن محطة ${name}.`),
  metroRoute: (from, to, transfers) => `${from} ← ${to}${transfers ? `، ${transfers === 1 ? 'تبديل واحد' : `${transfers} تبديلات`}` : ''}`,
  walkOnly: 'مشيًا طوال الطريق',
  walking: (min) => `${arMin(min)} مشيًا`,
  estimated: 'تقديري',
  live: 'مباشر',
  noTraffic: 'بلا زحام',
  estimatedHelp: '«تقديري» = حسبه التطبيق، لا خدمة توجيه.',
  sourceFree: 'بيانات مجانية: الأماكن من Overture Maps وOpenStreetMap (بلا تقييمات)، وأوقات السيارة من شبكة الطرق مع الزحام المعتاد لا الحي.',
  sourceGoogle: 'بيانات Google: أماكن مقيّمة، وأوقات سيارة بالزحام الحي، والمترو من Google للنقل العام.',
  carEstimated: 'لم تستجب خدمة توجيه السيارات، فأوقات السيارة تقديرية.',
  metroEstimatedNote: 'يقدّر التطبيق أوقات المترو هكذا: المشي إلى أقرب محطة بسرعة 5 كم/س، وانتظار 4 دقائق، و1.5 دقيقة لكل محطة، و5 دقائق لكل تبديل. ويُحسب المشي مرة ونصفًا لحرارة الجو.',
  minutes: (m) => arMin(m),
  openInMaps: 'افتح في خرائط Google',
  metroLayer: 'خطوط المترو',
  searchNoKey: 'البحث بالعنوان معطّل لأن GOOGLE_MAPS_API_KEY غير مضبوط في الخادم. استعمل «حدّد على الخريطة».',
  searchError: 'تعذّر البحث. أعد المحاولة أو استعمل «حدّد على الخريطة».',
  noMatches: 'لا نتائج مطابقة',
  metroAttribution: 'بيانات المترو © المساهمون في OpenStreetMap (ODbL)',
  mapCredits: 'الأماكن © Overture Maps Foundation وOpenStreetMap · المترو © OpenStreetMap (ODbL) · الأحياء © البريد السعودي عبر homaily (GPL-2.0)',
  lines: 'المسارات',
  interchange: 'محطة تبديل',
  lineNames: { '1': 'المسار الأزرق', '2': 'المسار الأحمر', '3': 'المسار البرتقالي', '4': 'المسار الأصفر', '5': 'المسار الأخضر', '6': 'المسار البنفسجي' },
  arriveStep: 'تصل إلى مكان اللقاء',
  carStep(s: CarStepInfo): string {
    const onto = s.road ? ` إلى ${s.road}` : '';
    const inRoad = s.road ? ` في ${s.road}` : '';
    const dir = AR_DIR[s.modifier ?? ''] ?? '';
    const sd = side(s.modifier) === 'left' ? 'يسارًا' : side(s.modifier) === 'right' ? 'يمينًا' : '';
    switch (s.type) {
      case 'depart':
        return `انطلق${inRoad}`;
      case 'arrive':
        return 'تصل إلى مكان اللقاء';
      case 'roundabout':
      case 'rotary':
        return `عند الدوّار اسلك ${s.exit ? `المخرج ${s.exit}` : 'المخرج'}${onto}`;
      case 'on ramp':
        return `اسلك المنحدر${sd ? ` ${sd}` : ''}${onto}`;
      case 'off ramp':
        return `اسلك المخرج${sd ? ` ${sd}` : ''}${onto}`;
      case 'fork':
        return `عند التفرّع الزم ${side(s.modifier) === 'left' ? 'اليسار' : side(s.modifier) === 'right' ? 'اليمين' : 'الطريق المستقيم'}${onto}`;
      case 'merge':
        return `اندمج${onto}`;
      case 'end of road':
        return `في نهاية الطريق انعطف ${dir || 'بحسب اللوحات'}${onto}`;
      case 'continue':
      case 'new name':
        return `تابع${inRoad}`;
      default:
        if (s.modifier === 'straight') return `تابع مباشرةً${inRoad}`;
        if (s.modifier === 'uturn') return `استدر عائدًا${onto}`;
        return `انعطف ${dir || 'إلى الأمام'}${onto}`;
    }
  },
};

export const STRINGS: Record<Locale, Strings> = { en, ar };

export function isLocale(x: unknown): x is Locale {
  return x === 'en' || x === 'ar';
}
