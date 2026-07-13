'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export function CardImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
        <ImageOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local /public thumbnail; next/image+sharp not used in this app
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onError={() => setBroken(true)}
      className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
    />
  );
}
