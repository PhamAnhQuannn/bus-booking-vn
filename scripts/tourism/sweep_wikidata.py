# -*- coding: utf-8 -*-
"""Wikidata (CC0) + Wikimedia Commons sweep for Da Lat."""
import json, sys, io, urllib.request, urllib.parse, time
OUT = sys.argv[1]
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"

Q = """
SELECT ?item ?itemLabel ?viLabel ?coord ?typeLabel ?image ?site WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(108.4454 11.9450)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "25" .
  }
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P856 ?site }
  OPTIONAL { ?item rdfs:label ?viLabel FILTER(lang(?viLabel)="vi") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "vi,en" }
}
"""
url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(Q)
req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
with urllib.request.urlopen(req, timeout=120) as r:
    data = json.load(r)
rows = data["results"]["bindings"]
io.open(OUT, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False))

seen = {}
for b in rows:
    qid = b["item"]["value"].rsplit("/", 1)[-1]
    lab = b.get("viLabel", {}).get("value") or b.get("itemLabel", {}).get("value", "")
    typ = b.get("typeLabel", {}).get("value", "")
    img = b.get("image", {}).get("value", "")
    site = b.get("site", {}).get("value", "")
    if qid not in seen:
        seen[qid] = {"label": lab, "types": set(), "img": img, "site": site}
    seen[qid]["types"].add(typ)
    if img: seen[qid]["img"] = img
    if site: seen[qid]["site"] = site

print(f"WIKIDATA: {len(rows)} bindings -> {len(seen)} distinct entities within 25 km")
withimg = sum(1 for v in seen.values() if v["img"])
withsite = sum(1 for v in seen.values() if v["site"])
print(f"  with P18 image: {withimg} ({100*withimg/max(len(seen),1):.0f}%)   with official site: {withsite}")
print()
SKIP = {"human", "commune of Vietnam", "ward", "administrative territorial entity"}
out = []
for qid, v in seen.items():
    t = ", ".join(sorted(x for x in v["types"] if x))
    out.append((v["label"], t, qid, "IMG" if v["img"] else "", v["site"][:40]))
out.sort()
for lab, t, qid, img, site in out:
    print(f"{lab[:42]:44s} | {t[:38]:40s} | {qid:9s} | {img:3s} | {site}")
