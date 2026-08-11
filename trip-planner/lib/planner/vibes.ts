// Vibe taxonomy — tập ĐÓNG slug "sở thích / không khí" khách nêu (deterministic, KHÔNG vector).
// Single source cho: allowlist (fromParams + partialFromArgs), match (plan.scoreDestination),
// prompt + chip (parseIntent, slots). KB field `ext.destination.vibes[]` chứa cùng slug set,
// sinh offline bởi `tourism-kb/code/vibes.py` — giữ 2 phía đồng bộ THỦ CÔNG (sửa 1 sửa cả 2).
// Client-safe: thuần hằng số, không kéo graph server.

export const VIBE_VOCAB = [
  // RULE (suy từ category KB)
  "ngam-canh",
  "tam-linh",
  "lich-su-van-hoa",
  "thien-nhien-mao-hiem",
  "mua-sam",
  "nong-nghiep-sinh-thai",
  "bien-dao",
  "suoi-nuoc-nong",
  // ENRICH (LLM offline đọc name+description)
  "song-ao-chup-hinh",
  "thu-gian-yen-tinh",
  "lang-man",
] as const;

export type Vibe = (typeof VIBE_VOCAB)[number];

const VIBE_SET: ReadonlySet<string> = new Set(VIBE_VOCAB);

export function isVibe(s: string): s is Vibe {
  return VIBE_SET.has(s);
}

// Lọc list interest thô → chỉ giữ slug hợp lệ (drop tag lạ / hallucinate). Lowercase, dedupe, giữ thứ tự.
// Đây là allowlist duy nhất trước khi interest chạm engine — không tin bất kỳ path nào (URL, LLM).
export function filterVibes(raw: string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const v = r.trim().toLowerCase();
    if (VIBE_SET.has(v) && !out.includes(v)) out.push(v);
  }
  return out;
}
