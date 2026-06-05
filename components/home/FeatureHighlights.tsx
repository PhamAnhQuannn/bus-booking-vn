import { Sparkles, MapPin, Headset, Check, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * FeatureHighlights — "Vì sao chọn BBVN?" benefits section above the carousels.
 * Centered header + 3 cards, each: icon panel · bold heading + tagline · key-detail
 * checklist. Static, no client JS.
 */

interface Feature {
  icon: LucideIcon;
  /** public/features/<slug>.jpg */
  slug: string;
  title: string;
  tagline: string;
  details: string[];
}

const FEATURES: Feature[] = [
  {
    icon: Sparkles,
    slug: 'service',
    title: 'Dịch vụ tuyệt vời',
    tagline: 'Xe đời mới, sạch sẽ, tài xế tận tâm cho mỗi chuyến đi.',
    details: ['Xe đời mới, ghế ngả êm ái', 'Tài xế lịch sự, đúng giờ', 'Đánh giá 4.8/5 từ hành khách'],
  },
  {
    icon: MapPin,
    slug: 'pickup',
    title: 'Đón trả tận nơi',
    tagline: 'Đón tại nhà hoặc khách sạn, trả đúng điểm bạn cần.',
    details: ['Đón tận nhà / khách sạn', 'Nhiều điểm đón linh hoạt', 'Không phát sinh phụ phí'],
  },
  {
    icon: Headset,
    slug: 'support',
    title: 'Hỗ trợ 24/7',
    tagline: 'Tổng đài và hỗ trợ trực tuyến mọi lúc, kể cả ngày lễ.',
    details: ['Tổng đài 24/7', 'Dịch vụ tận tình chu đáo', 'Xác nhận tức thì qua SMS'],
  },
];

export function FeatureHighlights() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Vì sao chọn BBVN?</h2>
        <p className="max-w-2xl text-base text-muted-foreground">
          Đặt vé xe khách nhanh, an toàn và tiện lợi trên toàn quốc.
        </p>
      </div>

      {/* Asymmetric bento: feature[0] is the hero cell (spans both rows on the left at
          lg), feature[1]/[2] stack as compact cells on the right. 3 items → 3 cells. */}
      <div className="reveal grid grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-2 lg:grid-cols-3 lg:grid-rows-2">
        {FEATURES.map(({ icon: Icon, slug, title, tagline, details }, i) => {
          const hero = i === 0;
          return (
            <article
              key={title}
              style={{ ['--i' as string]: i }}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-e1 transition-all hover:shadow-e2 motion-safe:hover:-translate-y-0.5',
                hero
                  ? 'md:col-span-1 md:row-span-2 lg:col-span-2 lg:row-span-2'
                  : 'md:col-span-1 md:row-span-1 lg:col-span-1 lg:row-span-1'
              )}
            >
              {/* Photo header + floating icon badge */}
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local /public thumbnail; next/image+sharp not used in this app */}
                <img
                  src={`/features/${slug}.jpg`}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    'w-full object-cover aspect-[16/10]',
                    hero ? 'md:aspect-[16/10]' : 'md:aspect-[16/7]'
                  )}
                />
                <span className="absolute bottom-0 left-6 flex size-12 translate-y-1/2 items-center justify-center rounded-xl bg-card text-primary shadow-e2 ring-1 ring-primary/10">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-6 pt-8">
                <div className="flex flex-col gap-1.5">
                  <h3 className={cn('font-bold tracking-tight', hero ? 'text-xl' : 'text-lg')}>
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{tagline}</p>
                </div>

                <ul className={cn('flex flex-col', hero ? 'gap-2' : 'gap-1.5')}>
                  {details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
