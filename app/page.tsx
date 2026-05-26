import type { Metadata } from 'next';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';

export const metadata: Metadata = {
  title: 'Đặt vé xe khách | BBVN',
  description: 'Tìm và đặt vé xe khách toàn quốc',
};

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          Đặt <span className="text-primary">vé</span> xe khách
        </h1>
        <p className="text-sm text-muted-foreground">
          Tìm chuyến xe phù hợp trên toàn quốc
        </p>
      </div>
      <SearchFormWrapper />
    </main>
  );
}
