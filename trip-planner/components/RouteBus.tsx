'use client';

/**
 * RouteBus — điểm nhấn THƯƠNG HIỆU DUY NHẤT của pha chờ: chiếc bus BBVN (tách từ mascot.svg)
 * chạy theo 1 đường cong CỐ ĐỊNH, kéo nét đứt cam brand (#F0561D — khớp màu route thật trên map).
 *
 * Kỹ thuật: bus = <div> chạy bằng CSS `offset-path` (offset-distance 0→100%, 8s vô hạn) trong 1 khung
 * 320×180 CĂN GIỮA; trail = <path> CÙNG toạ độ trong SVG 320×180 → bus & nét đứt khớp tuyệt đối,
 * không phụ thuộc kích thước map. `offset-path` là path CỐ ĐỊNH (route thật CHƯA tồn tại lúc chờ).
 *
 * reduced-motion: bus đứng yên 1 điểm + nét đứt tĩnh (class .bb-bus tự dừng animation trong globals.css).
 * KHÔNG confetti/particle/animation khác — mọi thứ còn lại tối giản.
 */

const BUS_PATH = 'M20 140 C 90 40 230 40 300 120 S 160 210 30 150';

export function RouteBus() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" aria-hidden>
      <div className="relative" style={{ width: 320, height: 180 }}>
        <svg width="320" height="180" viewBox="0 0 320 180" className="absolute inset-0">
          {/* nét đứt route — cam brand, mờ nhẹ */}
          <path d={BUS_PATH} fill="none" stroke="#F0561D" strokeWidth={3} strokeDasharray="5 9" strokeLinecap="round" opacity={0.4} />
        </svg>
        <div className="bb-bus" style={{ offsetPath: `path('${BUS_PATH}')` } as React.CSSProperties}>
          {/* bus tách từ public/planner/mascot.svg (<g translate 70 96>) — cam #F97316, cửa kem, bánh đậm */}
          <svg width="34" height="21" viewBox="0 0 86 52" aria-hidden>
            <rect x="0" y="0" width="86" height="40" rx="10" fill="#F97316" />
            <rect x="8" y="8" width="20" height="16" rx="4" fill="#FFF3E9" />
            <rect x="34" y="8" width="20" height="16" rx="4" fill="#FFF3E9" />
            <rect x="60" y="8" width="18" height="16" rx="4" fill="#FFF3E9" />
            <circle cx="22" cy="42" r="8" fill="#1F2937" />
            <circle cx="66" cy="42" r="8" fill="#1F2937" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default RouteBus;
