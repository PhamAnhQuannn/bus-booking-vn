/**
 * /lich-trinh — trang kết quả lịch trình (Phase C2a, render thẻ-theo-buổi).
 *
 * RSC gọi engine deterministic in-process (đọc KB export từ đĩa, nodejs runtime).
 * Không tham số -> lịch trình mẫu 3 ngày. Wizard nhập (C3) + bản đồ (C2b) + PDF sẽ nối sau.
 * Chỉ hiển thị các mục ĐƯỢC CHỌN (marketplace: thông tin + SĐT doanh nghiệp, không đặt hộ).
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildItinerary, getStore, requestFromParams, toURLSearchParams, cityName, CityDataUnavailableError, type SlotItem } from '@/trip-planner/lib/planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Translator kiểu 'planner' — truyền xuống helper module-scope (getTranslations là async trong RSC).
function getPlannerT() {
  return getTranslations('planner');
}
type PlannerT = Awaited<ReturnType<typeof getPlannerT>>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getPlannerT();
  return { title: t('metadata.scheduleTitle'), robots: { index: false } };
}

type SP = Record<string, string | string[] | undefined>;

export default async function LichTrinhPage({ searchParams }: { searchParams: Promise<SP> }) {
  const t = await getPlannerT();
  const sp = await searchParams;
  const req = requestFromParams(toURLSearchParams(sp));
  let it;
  try {
    it = buildItinerary(req, await getStore(req.slug));
  } catch (e) {
    if (e instanceof CityDataUnavailableError) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">{t('schedule.unsupportedTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('schedule.unsupportedDesc')}</p>
          <a href="/tro-ly-du-lich" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{t('schedule.unsupportedCta')}</a>
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t('schedule.heading', { days: req.days, city: cityName(req.slug) })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('schedule.paceLabel', { pace: paceLabel(t, req.pace) })} · {t('schedule.adults', { count: req.party.adults })}
          {req.party.elders > 0 ? ` · ${t('schedule.elders', { count: req.party.elders })}` : ''}
          {req.party.children > 0 ? ` · ${t('schedule.children', { count: req.party.children })}` : ''}
          {' · '}{t('schedule.dataSource', { source: it.generated_from })}
        </p>
      </header>

      <a
        href="/lien-he-dat-xe?from=planner"
        className="mb-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {t('schedule.bookCta')}
      </a>

      <div className="flex flex-col gap-6">
        {it.days.map((d) => (
          <section key={d.day}>
            <h2 className="mb-2 text-lg font-semibold text-primary-strong">
              {t('schedule.day', { day: d.day })}
              {d.region_id ? <span className="text-sm font-normal text-muted-foreground"> · {d.region_id}</span> : null}
            </h2>
            <div className="flex flex-col gap-3">
              {(d.items as SlotItem[]).map((i, idx) => (
                <PlaceCard key={`${d.day}-${idx}`} item={i} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {it.hotel ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-primary-strong">{t('schedule.hotelTitle')}</h2>
          <Card>
            <CardHeader>
              <CardTitle>{it.hotel.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {it.hotel.note ? <p>{it.hotel.note}</p> : null}
              {it.hotel.address ? <p>{it.hotel.address}</p> : null}
              {contactLine(t, it.hotel.phone, it.hotel.source_ids.length, it.hotel.ngay_du_lieu)}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {it.restaurants.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-primary-strong">{t('schedule.restaurantTitle')}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t('schedule.restaurantNote')}</p>
          <div className="flex flex-col gap-3">
            {it.restaurants.map((r, idx) => (
              <Card key={`res-${idx}`}>
                <CardHeader>
                  <CardTitle as="h3">{r.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>
                    {r.category ?? '—'}
                    {' · '}{t('schedule.hoursLabel')}{' '}
                    {r.goi_truoc ? <span className="text-primary-strong">{t('schedule.callAhead')}</span> : r.gio_mo}
                  </p>
                  {r.address ? <p>{r.address}</p> : null}
                  {contactLine(t, r.phone, r.source_ids.length, r.ngay_du_lieu)}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <aside className="mt-8 rounded-lg border border-info/40 bg-info/5 p-4 text-sm">
        <p className="mb-1 font-medium">{t('schedule.notesTitle')}</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {it.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

function PlaceCard({ item, t }: { item: SlotItem; t: PlannerT }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="flex flex-wrap items-baseline gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {t(`schedule.buoi.${item.buoi}`)}
          </span>
          {item.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          {item.category ?? '—'}
          {' · '}{t('schedule.hoursLabel')}{' '}
          {item.goi_truoc ? <span className="text-primary-strong">{t('schedule.callAhead')}</span> : item.gio_mo}
        </p>
        {item.address ? <p>{item.address}</p> : null}
        {contactLine(t, item.phone, item.source_ids.length, item.ngay_du_lieu)}
      </CardContent>
    </Card>
  );
}

function contactLine(t: PlannerT, phone: string | null, nSources: number, ngay: string | null) {
  return (
    <p className="mt-1 text-xs">
      {phone ? (
        <a href={`tel:${phone}`} className="text-primary underline">
          {phone}
        </a>
      ) : (
        <span className="text-muted-foreground">{t('schedule.noPhone')}</span>
      )}
      <span className="text-muted-foreground">
        {' · '}{t('schedule.sources', { count: nSources })}
        {ngay ? ` · ${t('schedule.updated', { date: ngay })}` : ''}
      </span>
    </p>
  );
}

function paceLabel(t: PlannerT, p: string): string {
  const key = p === 'relaxed' ? 'relaxed' : p === 'packed' ? 'packed' : 'moderate';
  return t(`schedule.pace.${key}`);
}
