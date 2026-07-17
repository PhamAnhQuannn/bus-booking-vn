'use client';

/**
 * QrImage — VietQR code with a graceful fallback.
 *
 * Audit F1/F4: the QR is served from an external host (img.vietqr.io); if that
 * host is ever unreachable or CSP-misconfigured again, this renders a clear
 * "use the manual details below" message instead of a broken-image glyph.
 */

import { useState } from 'react';

export function QrImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex size-[300px] max-w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted p-4 text-center text-sm text-muted-foreground">
        <p>Không tải được mã QR.</p>
        <p>Vui lòng chuyển khoản thủ công theo thông tin bên dưới.</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={300}
      height={300}
      className="rounded-lg border border-border"
      onError={() => setFailed(true)}
    />
  );
}
