// Format số/khoảng cách/điện thoại DÙNG CHUNG — không format tại chỗ (spec Polish V3 A4).
// Doctrine: chỉ định dạng, không bịa; input null/NaN → null (caller ẩn dòng).

// "~1,9 km" (1 chữ số lẻ, phẩy thập phân); < 1km → "~800 m" (làm tròn 10m gần nhất).
export function fmtKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `~${Math.round((km * 1000) / 10) * 10} m`;
  return `~${km.toFixed(1).replace(".", ",")} km`;
}

// "~8 phút" (làm tròn).
export function fmtMinutes(min: number | null | undefined): string | null {
  if (min == null || !Number.isFinite(min)) return null;
  return `~${Math.round(min)} phút`;
}

// Chuẩn hoá +84→0, di động 10 số nhóm 4-3-3 (vd "+8490xxxxxx01" → "0904 xxx x01").
// Máy bàn / định dạng lạ → trả nguyên văn đã trim (vd "0263 xxxx xxx" giữ nguyên).
export function fmtPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s.\-()]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (/^84\d{9,}$/.test(s)) s = "0" + s.slice(2);
  if (/^0\d{9}$/.test(s)) return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`; // di động 4-3-3
  return raw.trim();
}
