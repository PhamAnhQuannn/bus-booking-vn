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
    <section id="intro-banner" className="relative w-full overflow-hidden bg-primary text-primary-foreground">
      {/* Color field, desaturated as a GROUP so the orange reads as a calm terracotta brand
          band, not loud neon — primary base + burnt 2-tone + gold glow all mute together.
          The white content below is a sibling OUTSIDE this wrapper, so text/buttons keep full
          contrast. saturate/brightness tuned for "muted orange". */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-primary [filter:saturate(0.7)_brightness(0.97)]"
      >
        {/* Two-tone warm field: bright orange top-left deepening to a burnt orange (orange-900,
            mood-board "deeper orange") bottom-right — light→deep axis, dimension not flat tone. */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(124,45,18,0.18)_45%,rgba(124,45,18,0.55)_100%)]" />
        {/* Off-axis brand glow: one organic light pool drifting from top-left + a fixed warm
            radial wash bottom-right. Two sources, not three symmetric orbs (no AI-blob look). */}
        <div className="absolute -left-24 -top-16 size-96 rounded-[42%_58%_56%_44%/48%_42%_58%_52%] bg-white/30 blur-3xl will-change-transform motion-safe:animate-[blob_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(58%_55%_at_85%_112%,rgba(252,211,77,0.45),transparent_70%)]" />
        {/* Grounding vignette — subtle bottom darken for depth + headline-shadow support. */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/12" />
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
          BBVN kết nối bạn với hàng nghìn nhà xe trên toàn quốc. Tìm chuyến, đặt vé, thuê xe hợp đồng,
          nhanh và an toàn, hỗ trợ 24/7.
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
