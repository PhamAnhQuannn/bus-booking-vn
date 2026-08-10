# Wikidata

status: **draft** · nguồn: `tourism-kb/code/sweep_wikidata.py` + grill (POI list)

- Truy vấn **SPARQL "around"** (tâm + bán kính) — **miễn phí, không cần key**.
- Dùng cho enrich (QID, name:en) và — quan trọng cho tổng quát hoá — **số sitelink làm proxy
  "nổi tiếng"** để chọn allowlist POI thay cho gõ tay 34 tên (grill Q1). Sitelink = số phiên bản
  ngôn ngữ Wikipedia của một mục → tín hiệu độ nổi tiếng khách quan, có thể tái lập cho mọi thành phố.
- Lịch sự với endpoint công cộng (rate-limit, User-Agent). Cân nhắc nhịp truy vấn.

Việc cần: [ ] chốt ngưỡng sitelink + cách trộn với điểm thuật toán khi làm Phase E.
