/**
 * ContractCarRental — "Dịch vụ thuê xe hợp đồng". Tinted rounded panel, one horizontal row of
 * four zones (image #16): [eyebrow + heading + copy] · [outlined CTA pill] · [vehicle photo] ·
 * [trust as a VERTICAL column on the right]. The CTA is temporarily disabled (no rental page yet).
 *
 * Orange-tinted (`bg-primary/5`) rounded panel — sits last, below the operator showcase, as the
 * page's warm closing band. On the landing page's white field the tint reads as an accent block.
 *
 * The mockup's van cutout has no equivalent asset; the existing hero coach photo stands in.
 */

import Link from 'next/link';
import { ArrowRight, BadgeCheck, BusFront, Headset, Wallet } from 'lucide-react';

const TRUST = [
  { icon: BusFront, label: 'Xe đời mới, sạch sẽ' },
  { icon: BadgeCheck, label: 'Tài xế kinh nghiệm' },
  { icon: Wallet, label: 'Giá minh bạch' },
  { icon: Headset, label: 'Hỗ trợ tận tâm' },
];

export function ContractCarRental() {
  return (
    <section className="page-container py-3 lg:py-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-[#FFF3E9]">
        <div className="flex flex-col gap-6 p-6 lg:min-h-[220px] lg:flex-row lg:items-stretch lg:gap-6 lg:p-8">
          {/* Zone 1 — text; the CTA sits on the eyebrow line, right-aligned to the title's right edge. */}
          <div className="flex flex-col gap-2 lg:justify-center">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Thuê xe hợp đồng
              </span>
              {/* outlined orange CTA pill → live contract-rental quote form. */}
              <Link
                href="/lien-he-dat-xe"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 bg-card px-3.5 py-1.5 text-xs font-medium text-primary-strong transition-colors hover:bg-primary/5"
              >
                Xem dịch vụ thuê xe
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Dịch vụ thuê xe cho mọi nhu cầu
            </h2>
            <p className="max-w-md text-sm text-foreground/80">
              Xe 4 – 45 chỗ cho nhóm, doanh nghiệp, sự kiện, du lịch, cưới hỏi…
            </p>
          </div>

          {/* Zone 3 — vehicle photo (xl only): LEFT edge feathers into the cream panel field,
              RIGHT edge carries the deco (crisp orange rule + glass highlight + rounded corners). */}
          <div className="relative hidden min-w-0 self-stretch overflow-hidden rounded-r-2xl -my-6 lg:-my-8 lg:block lg:flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local /public photo; next/image+sharp not used in this app */}
            <img
              src="/hero/contract-rental-wide.jpg"
              alt="Xe hợp đồng BBVN"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover object-[center_80%] [mask-image:linear-gradient(to_right,transparent,#000_40%)]"
            />
            {/* warm brand wash — feathered on the same left axis so it doesn't paint the dissolve zone */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary-strong/25 via-transparent to-transparent [mask-image:linear-gradient(to_right,transparent,#000_38%)]" />
            {/* right-edge deco: crisp orange rule at the very edge */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-primary/40" />
            {/* inner glass highlight, meaningful only on the right half */}
            <div className="pointer-events-none absolute inset-0 rounded-r-2xl ring-1 ring-inset ring-white/15 [mask-image:linear-gradient(to_right,transparent,#000_50%)]" />
          </div>

          {/* Zone 4 — trust column: items spread evenly across the full block height,
              a hairline divider between each. */}
          <ul className="flex list-none flex-col self-stretch divide-y divide-border/40 -my-6 lg:-my-8">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-1 items-center gap-2 py-1 text-sm text-foreground/80">
                <Icon className="size-[18px] shrink-0 text-primary-strong" strokeWidth={2.5} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
