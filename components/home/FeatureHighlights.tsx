import { CircleCheck } from 'lucide-react';

/**
 * FeatureHighlights — "Vì sao chọn BBVN?" benefits section. Rebuilt 2026-07-21 to the
 * mockup's two-column layout (docs/design/mockup-home.png S6): sleeper-bus interior photo
 * on the left, eyebrow + two-line heading + four checked benefit rows on the right, the
 * text column vertically centred against the photo. Static, no client JS.
 */

interface Benefit {
  title: string;
  description: string;
}

const BENEFITS: Benefit[] = [
  {
    title: 'Đa dạng tuyến đường',
    description: 'Nhiều tuyến xe khách liên tỉnh trên toàn quốc.',
  },
  {
    title: 'Giá tốt mỗi ngày',
    description: 'So sánh giá từ nhiều nhà xe để chọn mức tốt nhất.',
  },
  {
    title: 'Đặt vé nhanh chóng',
    description: 'Giao diện đơn giản, đặt vé chỉ trong 30 giây.',
  },
  {
    title: 'An toàn & đáng tin cậy',
    description: 'Đối tác uy tín, xe chất lượng, tài xế chuyên nghiệp.',
  },
];

export function FeatureHighlights() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-10">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[45%_1fr] lg:gap-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- local /public photo; next/image+sharp not used in this app */}
        <img
          src="/features/service.jpg"
          alt="Khoang giường nằm trên xe khách"
          loading="lazy"
          decoding="async"
          className="aspect-[3/2] w-full rounded-xl object-cover shadow-e1"
        />

        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Vì sao chọn BBVN?
          </span>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="block">Trải nghiệm khác biệt</span>
            <span className="block">trên từng hành trình</span>
          </h2>

          <ul className="mt-3 flex list-none flex-col gap-5 p-0">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{b.title}</span>
                  <span className="text-sm text-muted-foreground">{b.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
