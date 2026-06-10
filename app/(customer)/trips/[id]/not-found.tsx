import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

/**
 * Segment not-found for /trips/[id] — rendered when getTripDetails() resolves to
 * null (trip missing, sales closed, departed, or operator not search-visible).
 * Gives a forward path back into search instead of a generic dead-end.
 */
export default function TripNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Chuyến xe không khả dụng</p>
        <h1 className="text-2xl font-bold">Không tìm thấy chuyến xe</h1>
        <p className="text-sm text-muted-foreground">
          Chuyến xe này không còn nhận đặt vé hoặc đã khởi hành. Hãy tìm một chuyến khác.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/search" className={buttonVariants({ variant: 'default', size: 'lg' })}>
          Về tìm kiếm
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
