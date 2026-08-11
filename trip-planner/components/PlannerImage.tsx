'use client';

/**
 * Ảnh placeholder an toàn: nếu file chưa có (user chưa drop ảnh thật) → onError ẩn <img>,
 * lộ nền gradient + emoji fallback (tránh icon broken-image). Thay ảnh thật vào public/ là xong,
 * không đổi code. Dùng <img> thường (không next/image) để 404 không log lỗi build/RSC.
 */

import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  alt: string;
  className?: string;
  fallbackEmoji?: string;
};

export function PlannerImage({ src, alt, className, fallbackEmoji = '🖼️' }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Bắt lỗi ảnh 404 fail TRƯỚC khi React gắn onError (hydration race —
  // cardimage-onerror-race): img.complete && naturalWidth===0 = đã lỗi → fallback ngay.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 ${className ?? ''}`}>
      {failed ? (
        <div className="grid h-full w-full place-items-center text-3xl opacity-40" aria-hidden>
          {fallbackEmoji}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={ref} src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
