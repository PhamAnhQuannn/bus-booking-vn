/**
 * /routes — public browse-all-routes page.
 *
 * Lists every active route that has an upcoming bookable trip, grouped by
 * origin/destination. Cards deep-link into /search prefilled with today's date.
 */

import type { Metadata } from 'next';
import { getActiveRoutes } from '@/lib/core/db/getActiveRoutes';
import { RoutesBrowser } from './RoutesBrowser';

export const metadata: Metadata = {
  title: 'Tuyến đường | BBVN',
  description: 'Khám phá các tuyến xe khách liên tỉnh đang mở bán.',
};

export const dynamic = 'force-dynamic';

/** Today's date (YYYY-MM-DD) in Asia/Ho_Chi_Minh. Module-scope so the RSC render
 * body stays pure (react-hooks/purity — see Issue 016 mistake-log entry). */
function getTodayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export default async function RoutesPage() {
  const routes = await getActiveRoutes();
  const today = getTodayVN();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Tuyến đường</h1>
        <p className="text-sm text-muted-foreground">
          {routes.length} tuyến đang mở bán. Chọn tuyến để xem chuyến hôm nay.
        </p>
      </div>

      {routes.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
          Hiện chưa có tuyến nào mở bán.
        </p>
      ) : (
        <RoutesBrowser routes={routes} today={today} />
      )}
    </main>
  );
}
