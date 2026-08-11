/**
 * /lich-trinh — trang kết quả lịch trình (Phase C2a, render thẻ-theo-buổi).
 *
 * RSC gọi engine deterministic in-process (đọc KB export từ đĩa, nodejs runtime).
 * Không tham số -> lịch trình mẫu 3 ngày. Wizard nhập (C3) + bản đồ (C2b) + PDF sẽ nối sau.
 * Chỉ hiển thị các mục ĐƯỢC CHỌN (marketplace: thông tin + SĐT doanh nghiệp, không đặt hộ).
 */

import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildItinerary, getStore, requestFromParams, toURLSearchParams, cityName, CityDataUnavailableError, type SlotItem } from '@/trip-planner/lib/planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Lịch trình gợi ý', robots: { index: false } };

const BUOI: Record<string, string> = { sang: 'Sáng', trua: 'Trưa', chieu: 'Chiều', toi: 'Tối' };

type SP = Record<string, string | string[] | undefined>;

export default async function LichTrinhPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const req = requestFromParams(toURLSearchParams(sp));
  let it;
  try {
    it = buildItinerary(req, await getStore(req.slug));
  } catch (e) {
    if (e instanceof CityDataUnavailableError) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Chưa hỗ trợ thành phố này</h1>
          <p className="mt-2 text-muted-foreground">Lịch trình gợi ý hiện chưa có cho địa điểm bạn chọn. Vui lòng thử một thành phố khác.</p>
          <a href="/tro-ly-du-lich" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">← Chọn thành phố khác</a>
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Lịch trình {req.days} ngày · {cityName(req.slug)}</h1>
        <p className="text-sm text-muted-foreground">
          Nhịp: {paceLabel(req.pace)} · {req.party.adults} người lớn
          {req.party.elders > 0 ? ` · ${req.party.elders} người lớn tuổi` : ''}
          {req.party.children > 0 ? ` · ${req.party.children} trẻ nhỏ` : ''}
          {' · '}dữ liệu: {it.generated_from}
        </p>
      </header>

      <a
        href="/lien-he-dat-xe?from=planner"
        className="mb-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Đặt xe cho chuyến này →
      </a>

      <div className="flex flex-col gap-6">
        {it.days.map((d) => (
          <section key={d.day}>
            <h2 className="mb-2 text-lg font-semibold text-primary-strong">
              Ngày {d.day}
              {d.region_id ? <span className="text-sm font-normal text-muted-foreground"> · {d.region_id}</span> : null}
            </h2>
            <div className="flex flex-col gap-3">
              {(d.items as SlotItem[]).map((i, idx) => (
                <PlaceCard key={`${d.day}-${idx}`} item={i} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {it.hotel ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-primary-strong">Khách sạn gợi ý</h2>
          <Card>
            <CardHeader>
              <CardTitle>{it.hotel.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {it.hotel.note ? <p>{it.hotel.note}</p> : null}
              {it.hotel.address ? <p>{it.hotel.address}</p> : null}
              {contactLine(it.hotel.phone, it.hotel.source_ids.length, it.hotel.ngay_du_lieu)}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {it.restaurants.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-primary-strong">Gợi ý quán ăn</h2>
          <p className="mb-3 text-sm text-muted-foreground">Gợi ý theo mức được quan tâm; không gắn vào lịch từng buổi — chọn tuỳ khẩu vị.</p>
          <div className="flex flex-col gap-3">
            {it.restaurants.map((r, idx) => (
              <Card key={`res-${idx}`}>
                <CardHeader>
                  <CardTitle as="h3">{r.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>
                    {r.category ?? '—'}
                    {' · giờ: '}
                    {r.goi_truoc ? <span className="text-primary-strong">gọi trước</span> : r.gio_mo}
                  </p>
                  {r.address ? <p>{r.address}</p> : null}
                  {contactLine(r.phone, r.source_ids.length, r.ngay_du_lieu)}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <aside className="mt-8 rounded-lg border border-info/40 bg-info/5 p-4 text-sm">
        <p className="mb-1 font-medium">Lưu ý</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {it.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

function PlaceCard({ item }: { item: SlotItem }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="flex flex-wrap items-baseline gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {BUOI[item.buoi]}
          </span>
          {item.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          {item.category ?? '—'}
          {' · giờ: '}
          {item.goi_truoc ? <span className="text-primary-strong">gọi trước</span> : item.gio_mo}
        </p>
        {item.address ? <p>{item.address}</p> : null}
        {contactLine(item.phone, item.source_ids.length, item.ngay_du_lieu)}
      </CardContent>
    </Card>
  );
}

function contactLine(phone: string | null, nSources: number, ngay: string | null) {
  return (
    <p className="mt-1 text-xs">
      {phone ? (
        <a href={`tel:${phone}`} className="text-primary underline">
          {phone}
        </a>
      ) : (
        <span className="text-muted-foreground">chưa có SĐT</span>
      )}
      <span className="text-muted-foreground">
        {' · '}nguồn: {nSources}
        {ngay ? ` · cập nhật ${ngay}` : ''}
      </span>
    </p>
  );
}

function paceLabel(p: string): string {
  return p === 'relaxed' ? 'thư giãn' : p === 'packed' ? 'dày' : 'vừa';
}
