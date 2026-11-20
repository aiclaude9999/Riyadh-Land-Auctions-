"""
Riyadh cafés & restaurants from Overture Maps Places (open data, CDLA-Permissive-2.0).
Reads only the Riyadh row groups of the public parquet files over HTTPS (byte ranges), then keeps
food & drink places people sit in, with confidence >= 0.6 (Overture's suggested quality cut).

  python3 -m venv venv && venv/bin/pip install pyarrow requests
  venv/bin/python scripts/overture/extract_riyadh.py 2026-11-18.0 data/overture-riyadh.json
(behind a TLS-inspecting proxy set REQUESTS_CA_BUNDLE). Then: npm run build:venues
"""
import io, json, re, sys
import pyarrow.parquet as pq
import requests

RELEASE = sys.argv[1] if len(sys.argv) > 1 else "2026-11-18.0"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/overture-riyadh.json"
BASE = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
PREFIX = f"release/{RELEASE}/theme=places/type=place/"
S, W, N, E = 24.4, 46.4, 25.05, 47.05
MIN_CONFIDENCE = 0.6

CAFE = {"coffee_shop", "cafe", "tea_room", "coffee_roastery", "dessert_shop", "bakery", "ice_cream_shop", "donut_shop",
        "frozen_yogurt_shop", "smoothie_juice_bar", "lounge", "hookah_bar", "non_alcoholic_beverage_venue", "bubble_tea_shop", "cupcake_shop", "patisserie"}
SKIP = {"bar", "alcoholic_beverage_venue", "candy_store", "chocolatier", "food_truck_stand", "food_and_beverage_store", "grocery_store", "butcher_shop"}

sess = requests.Session()
sess.headers["User-Agent"] = "riyadh-meetup-point-prototype/0.1"


class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        self.size = int(sess.head(url, timeout=60).headers["Content-Length"])
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def readinto(self, b):
        n = len(b)
        if n == 0 or self.pos >= self.size: return 0
        end = min(self.size, self.pos + n) - 1
        r = sess.get(self.url, headers={"Range": f"bytes={self.pos}-{end}"}, timeout=300)
        r.raise_for_status()
        b[: len(r.content)] = r.content
        self.pos += len(r.content)
        return len(r.content)


AR = re.compile(r"[؀-ۿ]")


def split_name(s):
    """'Dunkin' - دانكن' → ('Dunkin'', 'دانكن'). Pure Arabic → (arabic, arabic)."""
    s = re.sub(r"\s+", " ", s or "").strip()
    arabic = " ".join(re.findall(r"[؀-ۿ][؀-ۿ\s\d]*", s)).strip()
    latin = re.sub(r"[؀-ۿ]+", " ", s)
    latin = re.sub(r"\s*[-–|/]\s*$|^\s*[-–|/]\s*", "", re.sub(r"\s+", " ", latin)).strip(" -–|/")
    if re.search(r"[A-Za-z]{2}", latin):
        return latin, arabic or None
    return s, (s if AR.search(s) else None)


def main():
    xml = sess.get(f"{BASE}/?list-type=2&prefix={PREFIX}", timeout=60).text
    keys = re.findall(r"<Key>([^<]+\.parquet)</Key>", xml)
    out, seen = [], 0
    for k in keys:
        pf = pq.ParquetFile(io.BufferedReader(RangeFile(f"{BASE}/{k}"), buffer_size=1 << 20))
        md = pf.metadata
        paths = [md.schema.column(i).path for i in range(md.num_columns)]
        ix, iy = paths.index("bbox.xmin"), paths.index("bbox.ymin")
        groups = []
        for g in range(md.num_row_groups):
            sx, sy = md.row_group(g).column(ix).statistics, md.row_group(g).column(iy).statistics
            if sx is None or sy is None or (sx.max >= W and sx.min <= E and sy.max >= S and sy.min <= N):
                groups.append(g)
        if not groups:
            continue
        t = pf.read_row_groups(groups, columns=["id", "names", "taxonomy", "confidence", "bbox", "addresses", "brand", "operating_status"])
        for r in t.to_pylist():
            b = r["bbox"]
            if not (W <= b["xmin"] <= E and S <= b["ymin"] <= N):
                continue
            seen += 1
            tax = r["taxonomy"] or {}
            if (tax.get("hierarchy") or [None])[0] != "food_and_drink":
                continue
            cat = tax.get("primary") or ""
            if cat in SKIP or (r["confidence"] or 0) < MIN_CONFIDENCE or r.get("operating_status") == "permanently_closed":
                continue
            name, name_ar = split_name((r["names"] or {}).get("primary"))
            if not name:
                continue
            cuisine = re.sub(r"_(restaurant|shop|bar|room|venue)$", "", cat).replace("_", " ")
            addr = ((r["addresses"] or [{}])[0] or {}).get("freeform")
            brand = (((r["brand"] or {}).get("names") or {}) or {}).get("primary")
            out.append({
                "id": "ovt-" + r["id"].replace("-", "")[:20],
                "name": name,
                **({"nameAr": name_ar} if name_ar and name_ar != name else {}),
                "kind": "cafe" if cat in CAFE else "restaurant",
                "lat": round(b["ymin"], 6), "lng": round(b["xmin"], 6),
                **({"cuisine": cuisine} if cuisine not in ("restaurant", "food and drink", "casual eatery") else {}),
                **({"address": addr} if addr else {}),
                **({"brand": brand} if brand else {}),
                "confidence": round(r["confidence"], 2),
            })
    json.dump({"source": "Overture Maps Foundation (CDLA-Permissive-2.0)", "release": RELEASE, "placesInBox": seen, "venues": out},
              open(OUT, "w"), ensure_ascii=False)
    print(f"{len(out)} cafés/restaurants kept of {seen} places in the Riyadh box", file=sys.stderr)


if __name__ == "__main__":
    main()
