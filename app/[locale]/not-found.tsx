import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Không tìm thấy trang | BBVN',
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
        <p className="text-sm text-muted-foreground">
          Trang bạn tìm không tồn tại hoặc đã bị di chuyển.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: 'default', size: 'lg' })}>
          Về trang chủ
        </Link>
        <Link href="/#search" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Tìm chuyến xe
        </Link>
      </div>
    </main>
  );
}
