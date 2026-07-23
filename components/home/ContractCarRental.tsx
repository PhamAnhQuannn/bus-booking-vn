/**
 * ContractCarRental — "Dịch vụ thuê xe hợp đồng". Rebuilt 2026-07-21 to the mockup's
 * tinted panel (docs/design/mockup-home.png S7): a single inset rounded panel carrying an
 * eyebrow, two-line heading, body copy, an inline CTA to the right of the copy, a vehicle
 * photo on the right, and a four-item trust row along the bottom.
 *
 * This panel is the page's only mid-band tint — every other section sits on the flat page
 * field, so the tint is what breaks the run rather than alternating section wrappers.
 *
 * The mockup's van cutout has no equivalent asset; the existing hero coach photo stands in.
 */

import { ArrowRight, BadgeCheck, BusFront, Headset, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const TRUST = [
  { icon: BusFront, label: 'Xe đời mới, sạch sẽ' },
  { icon: BadgeCheck, label: 'Tài xế kinh nghiệm' },
  { icon: Wallet, label: 'Giá minh bạch' },
  { icon: Headset, label: 'Hỗ trợ tận tình' },
];

export function ContractCarRental() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-10">
      <div className="overflow-hidden rounded-2xl bg-primary/5">
        <div className="grid grid-cols-1 items-center gap-6 p-6 lg:grid-cols-[1fr_auto_auto] lg:gap-8 lg:p-8">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Thuê xe hợp đồng
            </span>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="block">Dịch vụ thuê xe</span>
              <span className="block">cho mọi nhu cầu</span>
            </h2>
            <p className="max-w-md text-sm text-foreground/80">
              Xe 4 – 45 chỗ đời mới, phục vụ du lịch, sự kiện, đưa đón sân bay, cưới hỏi,
              công tác…
            </p>
          </div>

          {/* CTA sits beside the copy, not below it — measured off the mockup (S7). */}
          <a
            href="/lien-he-dat-xe"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'shrink-0 gap-2 rounded-lg bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 [a]:hover:bg-primary-strong/90'
            )}
          >
            Nhận báo giá ngay
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>

          {/* Purpose-cut to this box's 2.25 aspect (scripts/hero-cut.py). Do NOT
              point this at a hero variant: it used to use landing-golden-1280,
              which was fine while that file was landscape, but the mobile hero
              is now portrait 0.550 and object-cover reduced it to a close-up of
              the windscreen. A hero recut should not be able to reframe this
              section. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public photo; next/image+sharp not used in this app */}
          <img
            src="/hero/contract-rental-thumb.jpg"
            alt="Xe hợp đồng BBVN"
            loading="lazy"
            decoding="async"
            className="hidden h-32 w-72 shrink-0 rounded-xl object-cover xl:block"
          />
        </div>

        <ul className="grid list-none grid-cols-2 gap-4 border-t border-border/50 p-6 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/50 lg:p-0">
          {TRUST.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 text-sm text-foreground/80 lg:justify-center lg:px-4 lg:py-5"
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
