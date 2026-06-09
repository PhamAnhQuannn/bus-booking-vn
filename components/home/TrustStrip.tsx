import { Bus, Route as RouteIcon, ShieldCheck } from 'lucide-react';

import type { HomeMetrics } from '@/lib/home';
import { TRUST_FLOOR, trustMetric, type TrustMetricDisplay } from './trustDisplay';

/**
 * TrustStrip — thin scale/social-proof band under the hero (OTA "early trust"
 * slot, Busbud/Rome2Rio pattern). Server component, no motion.
 *
 * Each metric shows its number only above a floor; below the floor it falls back
 * to qualitative copy, so the page never advertises scale it lacks (no fake-precise
 * numbers). Display/threshold logic lives in ./trustDisplay (unit-tested).
 */

type Item = TrustMetricDisplay & { icon: typeof Bus };

function buildItems(m: HomeMetrics): Item[] {
  return [
    { icon: RouteIcon, ...trustMetric(m.routes, TRUST_FLOOR.routes, 'tuyến đang mở bán', 'Nhiều tuyến đường liên tỉnh') },
    { icon: Bus, ...trustMetric(m.trips, TRUST_FLOOR.trips, 'chuyến sắp khởi hành', 'Chuyến chạy mỗi ngày') },
    { icon: ShieldCheck, ...trustMetric(m.operators, TRUST_FLOOR.operators, 'nhà xe toàn quốc', 'Nhiều nhà xe toàn quốc') },
  ];
}

export function TrustStrip({ metrics }: { metrics: HomeMetrics }) {
  const items = buildItems(metrics);
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6">
      <ul className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
        {items.map(({ icon: Icon, value, label }) => (
          <li key={label} className="flex items-center justify-center gap-2.5 text-sm">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="text-muted-foreground">
              {value ? (
                <>
                  <span className="font-mono text-base font-bold text-foreground">{value}</span>{' '}
                  {label}
                </>
              ) : (
                <span className="font-medium text-foreground">{label}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
