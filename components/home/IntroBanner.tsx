import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * IntroBanner — full-bleed animated brand band introducing the app (closing CTA).
 * Floating blurred blobs (motion-safe) + grain over the orange brand colour.
 * Static / CSS-only animation.
 */
export function IntroBanner() {
  return (
    <section className="relative w-full overflow-hidden bg-primary text-primary-foreground">
      {/* Floating glow blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-16 size-72 rounded-full bg-white/25 blur-3xl will-change-transform motion-safe:animate-[blob_18s_ease-in-out_infinite]" />
        <div className="absolute -bottom-24 right-0 size-80 rounded-full bg-amber-300/30 blur-3xl will-change-transform motion-safe:animate-[blob_24s_ease-in-out_infinite_reverse]" />
        <div className="absolute left-1/3 top-1/4 size-64 rounded-full bg-white/10 blur-3xl will-change-transform motion-safe:animate-[blob_30s_ease-in-out_infinite]" />
      </div>
      {/* Grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
        <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
          Nền tảng đặt xe toàn quốc
        </span>

        <h2 className="font-display text-3xl font-bold tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.18)] sm:text-4xl md:text-5xl">
          Cả nước trong tầm tay bạn
        </h2>

        <p className="max-w-2xl text-base text-primary-foreground/90 sm:text-lg">
          BBVN kết nối bạn với hàng nghìn nhà xe trên toàn quốc — tìm chuyến, đặt vé, thuê xe hợp đồng.
          Nhanh, an toàn, hỗ trợ 24/7.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#search"
            className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5 bg-white text-primary shadow-e2 hover:bg-white/90')}
          >
            Tìm chuyến xe ngay
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          <Link
            href="/lien-he-dat-xe"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white'
            )}
          >
            Liên hệ đặt xe
          </Link>
        </div>
      </div>
    </section>
  );
}
