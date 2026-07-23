import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * IntroBanner — full-bleed brand band closing the page (closing CTA).
 * Cream field with dark ink; orange is carried by the top rule and the primary CTA only.
 * Floating blurred blob (motion-safe) + grain for texture. Static / CSS-only animation.
 */
export function IntroBanner() {
  return (
    <section
      id="intro-banner"
      className="relative w-full overflow-hidden border-t-4 border-t-primary bg-[#ffb682] text-foreground"
    >
      {/* Decorative wash. The field is cream, not orange: white-on-orange cannot clear AA at any
          orange light enough to avoid reading as a deep red slab, and C1 bars orange as a field
          colour outright. Every layer here is therefore a low-alpha warm tint — the band's actual
          brand orange lives on the top rule and the primary CTA, both at full strength. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Two-tone warm field: cream top-left deepening toward a warm tint bottom-right —
            light→deep axis, dimension not flat tone. Brand hue, not the old burnt umber, which
            over a light field read as a stain rather than a shadow. */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(245,74,0,0.04)_45%,rgba(245,74,0,0.09)_100%)]" />
        {/* Off-axis brand glow: one organic pool drifting from top-left + a fixed warm radial wash
            bottom-right. Two sources, not three symmetric orbs (no AI-blob look). The pool is a
            brand tint, not white — on cream, white has nothing to read against. */}
        <div className="absolute -left-24 -top-16 size-96 rounded-[42%_58%_56%_44%/48%_42%_58%_52%] bg-primary/12 blur-3xl will-change-transform motion-safe:animate-[blob_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(58%_55%_at_85%_112%,rgba(252,211,77,0.22),transparent_70%)]" />
      </div>
      {/* Grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
        <span className="rounded-full border border-primary/20 bg-white px-4 py-1.5 text-sm font-medium text-primary-strong">
          Nền tảng đặt xe toàn quốc
        </span>

        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Cả nước trong tầm tay bạn
        </h2>

        {/* foreground/80, not muted-foreground: #6e6862 on this peach field is 4.06:1 and fails
            AA. The alpha ink composites to 7.79:1 and keeps the h2/body hierarchy. */}
        <p className="max-w-2xl text-base text-foreground/80 sm:text-lg">
          BBVN kết nối bạn với các nhà xe uy tín. Tìm chuyến, đặt vé, thuê xe hợp đồng — nhanh và
          an toàn, hỗ trợ 24/7.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          {/* The one orange fill in this band (C2: one primary orange per screen). A one-off hex,
              not --primary-strong (#ca3500): at hue 15.7deg that token reads brick-red as a filled
              slab. #bd4700 is hue 22.5deg at full chroma (B=0) — brown is just orange at low
              lightness, so chroma is what keeps a dark fill reading burnt-orange rather than mud.
              Hover carries no colour change (the repo's OperatorShowcase idiom): an alpha hover
              LIGHTENS toward the cream field, and a brightness filter dims the white label too —
              both made hover the binding contrast state. Elevation-only keeps resting == worst
              case at 4.95:1. Both hover:bg- overrides are required: the default variant ships
              `hover:bg-primary/90 [a]:hover:bg-primary/90`, and the `[a]:` one adds an element
              selector, so it outranks a plain `hover:bg-*`. Left unpinned it snaps to #f54a00
              on hover — white-on-that is 3.13:1. */}
          <a
            href="#search"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'gap-1.5 bg-[#bd4700] text-primary-foreground shadow-e2 hover:bg-[#bd4700] [a]:hover:bg-[#bd4700] hover:shadow-e3 motion-safe:hover:-translate-y-0.5'
            )}
          >
            Tìm chuyến xe ngay
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          {/* Secondary stays neutral so it does not compete with the CTA above. Solid border, not
              an alpha one — no /NN border of any hue clears 1.4.11's 3:1 against a cream field. */}
          <Link
            href="/lien-he-dat-xe"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'border-muted-foreground bg-white text-foreground hover:bg-muted'
            )}
          >
            Liên hệ đặt xe
          </Link>
        </div>
      </div>
    </section>
  );
}
