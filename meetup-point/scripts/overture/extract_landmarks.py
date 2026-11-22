"""
Riyadh landmarks for the starting-point search (malls, hotels, universities, hospitals, parks,
stadiums, museums, airport, stations, embassies) + well-known area names that are not official
districts (Al Batha, Hittin…), from Overture Maps Places (CDLA-Permissive-2.0).
Input: a raw Riyadh extract (all categories) made with extract_riyadh.py's reader.
  venv/bin/python scripts/overture/extract_landmarks.py raw.json data/landmarks-riyadh.json
"""
import json, re, sys, statistics

KINDS = {
    'shopping_mall': 'mall', 'hotel': 'hotel', 'resort': 'hotel', 'college_university': 'university',
    'hospital': 'hospital', 'park': 'park', 'national_park': 'park', 'amusement_park': 'park', 'water_park': 'park',
    'stadium_arena': 'stadium', 'museum': 'museum', 'airport': 'airport', 'airport_terminal': 'airport',
    'train_station': 'station', 'embassy': 'embassy',
}
AREAS = [  # name, Arabic, pattern found in addresses/names
    ('Al Batha', 'البطحاء', r'bat.?ha|البطحاء'), ('Hittin', 'حطين', r'hittin|hitteen|حطين'),
    ('Diriyah', 'الدرعية', r'diriyah|الدرعية'), ('Diplomatic Quarter', 'حي السفارات', r'diplomatic|السفارات'),
    ('KAFD', 'المركز المالي', r'kafd|financial district|المركز المالي'),
]

def split(s):
    s = re.sub(r'\s+', ' ', s or '').strip()
    ar = ' '.join(re.findall(r'[؀-ۿ][؀-ۿ\s\d]*', s)).strip()
    la = re.sub(r'[؀-ۿ]+', ' ', s)
    la = re.sub(r'\s+', ' ', la).strip(' -–|/')
    return (la, ar or None) if re.search(r'[A-Za-z]{2}', la) else (s, s if ar else None)

raw = json.load(open(sys.argv[1]))
out, seen = [], set()
for x in raw:
    cat = (x.get('taxonomy') or {}).get('primary')
    if cat not in KINDS or (x.get('confidence') or 0) < 0.75: continue
    name, ar = split((x.get('names') or {}).get('primary'))
    if not name or len(name) < 3: continue
    lat, lng = round(x['bbox']['ymin'], 5), round(x['bbox']['xmin'], 5)
    key = (name.lower(), round(lat, 3), round(lng, 3))
    if key in seen: continue
    seen.add(key)
    out.append({'name': name, **({'nameAr': ar} if ar and ar != name else {}), 'kind': KINDS[cat], 'lat': lat, 'lng': lng})
for en, ar, pat in AREAS:
    pts = [(x['bbox']['ymin'], x['bbox']['xmin']) for x in raw if re.search(pat, ((x.get('addresses') or [{}])[0] or {}).get('freeform') or '' + ' ' + ((x.get('names') or {}).get('primary') or ''), re.I)]
    if len(pts) >= 20:
        out.append({'name': en, 'nameAr': ar, 'kind': 'area', 'lat': round(statistics.median(p[0] for p in pts), 5), 'lng': round(statistics.median(p[1] for p in pts), 5)})
# famous places people search by their common name (positions = median of Overture places with that name)
FAMOUS = [
    {'name': 'Kingdom Centre (Kingdom Tower)', 'nameAr': 'برج المملكة (المملكة سنتر)', 'kind': 'mall', 'lat': 24.7113, 'lng': 46.6746, 'famous': True},
    {'name': 'Al Faisaliah Tower & Mall', 'nameAr': 'برج الفيصلية', 'kind': 'mall', 'lat': 24.6899, 'lng': 46.6865, 'famous': True},
    {'name': 'Riyadh Park Mall', 'nameAr': 'الرياض بارك', 'kind': 'mall', 'lat': 24.7561, 'lng': 46.6301, 'famous': True},
    {'name': 'Boulevard Riyadh City', 'nameAr': 'بوليفارد رياض سيتي', 'kind': 'area', 'lat': 24.7677, 'lng': 46.6047, 'famous': True},
]
out = FAMOUS + out
json.dump({'source': 'Overture Maps Foundation (CDLA-Permissive-2.0)', 'landmarks': out}, open(sys.argv[2], 'w'), ensure_ascii=False)
print(len(out), 'landmarks')
