'use client';

import { useEffect } from 'react';

/**
 * Root error boundary — replaces the root layout when a layout-level render
 * crashes, so it must render its own <html>/<body>. Kept dependency-light on
 * purpose: this is the last-resort fallback and must not itself throw.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Đã xảy ra lỗi nghiêm trọng</h1>
            <p className="text-sm text-muted-foreground">
              Ứng dụng gặp sự cố không mong muốn. Vui lòng tải lại trang.
            </p>
            {error.digest ? (
              <p className="text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
          >
            Tải lại
          </button>
        </main>
      </body>
    </html>
  );
}
