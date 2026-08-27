'use client';

/**
 * PlanSkeleton — khung chờ pha `building` MÔ PHỎNG ĐÚNG anatomy của ItineraryCard
 * (không dùng hộp chữ nhật generic) → khi nội dung thật thay vào KHÔNG reflow (CLS≈0).
 *
 * Mỗi card giả tái hiện: vòng thứ tự trên spine + [dòng buổi·tên] + [dòng meta] +
 * [câu giới thiệu] + [3 dòng mô tả] + [hàng tag chips] + [khối gợi ý biên tập].
 * Cao ~250–300px/card khớp card thật. Shimmer qua class `.bb-shimmer` (CSS-only,
 * tự tắt khi prefers-reduced-motion). aria-hidden — vùng chờ có aria-busy ở panel cha.
 *
 * INVARIANT: KHÔNG chữ về địa điểm ở đây (chỉ thanh xám giả) — không bịa dữ liệu chờ.
 */

// Thanh giả 1 dòng (shimmer). w = lớp tiện ích chiều rộng.
function Bar({ w, h = 'h-3.5' }: { w: string; h?: string }) {
  return <div className={`bb-shimmer rounded ${h} ${w}`} />;
}

function SkeletonCard() {
  return (
    <div className="mb-3 flex gap-3">
      {/* spine + vòng thứ tự */}
      <div className="bb-shimmer mt-1 size-6 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 rounded-xl border border-[#F0EAE2] p-3">
        {/* dòng tiêu đề: buổi + tên điểm */}
        <div className="flex items-center gap-2">
          <Bar w="w-12" h="h-3" />
          <Bar w="w-40" h="h-4" />
        </div>
        {/* dòng meta: category · trải nghiệm · cách khách sạn */}
        <div className="mt-2 flex gap-2">
          <Bar w="w-20" h="h-3" />
          <Bar w="w-24" h="h-3" />
        </div>
        {/* câu giới thiệu + 3 dòng mô tả */}
        <div className="mt-3 space-y-2">
          <Bar w="w-full" />
          <Bar w="w-11/12" />
          <Bar w="w-4/5" />
        </div>
        {/* hàng tag chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="bb-shimmer h-6 w-16 rounded-full" />
          <div className="bb-shimmer h-6 w-20 rounded-full" />
          <div className="bb-shimmer h-6 w-14 rounded-full" />
        </div>
        {/* khối gợi ý biên tập */}
        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
          <Bar w="w-24" h="h-3" />
          <div className="mt-1.5"><Bar w="w-full" h="h-3" /></div>
        </div>
      </div>
    </div>
  );
}

export function PlanSkeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`h-full w-full content-start overflow-hidden bg-white p-4 ${className}`}>
      {/* header số liệu (thay khi reveal) */}
      <div className="mb-4"><Bar w="w-2/3" h="h-8" /></div>
      {/* divider NGÀY 1 thật (khớp band card thật) */}
      <div className="mb-3 flex items-center gap-2">
        <span className="bb-shimmer h-5 w-16 rounded" />
        <span className="h-px flex-1 bg-[#F0EAE2]" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default PlanSkeleton;
