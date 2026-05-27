import type { Metadata } from 'next';
import Link from 'next/link';
import { Wallet, ShieldCheck, Bus, ArrowRight } from 'lucide-react';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';
import { Card, CardContent } from '@/components/ui/card';
import { getSearchablePlaces } from '@/lib/db/getSearchablePlaces';

export const metadata: Metadata = {
  title: 'Đặt vé xe khách | BBVN',
  description: 'Tìm và đặt vé xe khách liên tỉnh trên toàn quốc — đặt trong 30 giây.',
};

const TRUST = [
  { icon: Wallet, title: 'MoMo · ZaloPay · Thẻ', desc: 'Thanh toán nhanh, hoặc trả tiền mặt khi lên xe.' },
  { icon: ShieldCheck, title: 'Xác nhận qua SMS', desc: 'Nhà xe gọi xác nhận giờ đón & chỗ ngồi.' },
  { icon: Bus, title: 'Nhiều nhà xe', desc: 'So sánh chuyến trên toàn quốc, không cần chọn ghế.' },
];

const POPULAR = [
  { origin: 'Hà Nội', destination: 'TP.HCM' },
  { origin: 'Đà Nẵng', destination: 'Huế' },
  { origin: 'Cần Thơ', destination: 'Đà Lạt' },
];

function popularHref({ origin, destination }: { origin: string; destination: string }) {
  return `/search?${new URLSearchParams({ origin, destination, ticketCount: '1' }).toString()}`;
}

export default async function HomePage() {
  const places = await getSearchablePlaces();
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero band */}
      <section className="w-full bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-12 text-center sm:py-16">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Đặt <span className="text-primary">vé xe khách</span> trong 30 giây
            </h1>
            <p className="text-base text-muted-foreground">
              Tìm chuyến, đặt vé, nhà xe gọi xác nhận. Không cần chọn ghế trên màn hình.
            </p>
          </div>

          <Card className="w-full text-left shadow-e3">
            <CardContent className="py-2">
              <SearchFormWrapper places={places} />
            </CardContent>
          </Card>

          {/* Popular routes */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Tuyến phổ biến:</span>
            {POPULAR.map((r) => (
              <Link
                key={`${r.origin}-${r.destination}`}
                href={popularHref(r)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium shadow-e1 transition-colors hover:border-primary/40 hover:text-primary"
              >
                {r.origin}
                <ArrowRight className="size-3.5 text-primary" aria-hidden="true" />
                {r.destination}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust row */}
      <section className="mx-auto w-full max-w-4xl px-4 py-10">
        <ul className="grid gap-4 sm:grid-cols-3">
          {TRUST.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-e1 transition-all hover:shadow-e2 motion-safe:hover:-translate-y-0.5">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="font-medium">{title}</span>
              <span className="text-sm text-muted-foreground">{desc}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
