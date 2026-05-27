'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Route-segment error boundary. Mirrors the route-handler `withErrorHandler`
 * posture: never surface the raw error to the user — show a generic message
 * and only the `digest` (a hash, safe to display) so support can correlate.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console/monitoring; do not render error internals.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Đã xảy ra lỗi</h1>
        <p className="text-sm text-muted-foreground">
          Có lỗi không mong muốn. Vui lòng thử lại sau giây lát.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Thử lại
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
