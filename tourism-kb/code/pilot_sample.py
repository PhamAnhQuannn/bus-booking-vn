import json, io, sys

slugs = ["quang-ninh", "bac-ninh", "thanh-hoa", "thai-nguyen", "da-lat", "lao-cai"]

out = {}
for slug in slugs:
    f = f"tourism-kb/export/{slug}/diem-den.json"
    data = json.load(open(f, encoding="utf-8"))
    recs = []
    for d in data:
        dest = d.get("ext", {}).get("destination", {})
        recs.append({
            "id": d.get("id"),
            "name": d.get("name"),
            "category": d.get("category", {}).get("primary"),
            "address": d.get("address", {}).get("full_address"),
            "place_id": d.get("external_ids", {}).get("google_place_id"),
            "ticketing": dest.get("ticketing"),
            "opening_hours": dest.get("opening_hours"),
        })
    out[slug] = recs

with io.open("D:/Bus-Booking/tourism-kb/code/pilot_sample_out.json", "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)

for slug in slugs:
    recs = out[slug]
    n_gia = sum(1 for r in recs if r["ticketing"])
    n_gio = sum(1 for r in recs if r["opening_hours"])
    print(slug, len(recs), "gia=", n_gia, "gio=", n_gio)
