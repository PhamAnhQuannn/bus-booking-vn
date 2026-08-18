'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Generic fallback photo for a card whose own destination/origin image is missing
 * (e.g. a boarding town without its own /destinations/<slug>.jpg). It's the hero
 * image — already loaded + browser-cached on the landing page, so reusing it here
 * costs zero extra download and keeps the card a real scenic photo instead of the
 * neutral "broken" tile. If even this fails, we fall to the ImageOff tile.
 */
const FALLBACK_SRC = '/hero/landing-golden-1920.jpg';

export function CardImage({
  src,
  alt,
  priority,
  fallbackSrc = FALLBACK_SRC,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  fallbackSrc?: string;
}) {
  // primary photo → generic fallback photo → neutral tile (last resort).
  const [stage, setStage] = useState<'primary' | 'fallback' | 'tile'>('primary');
  const advance = () => setStage((s) => (s === 'primary' ? 'fallback' : 'tile'));

  if (stage === 'tile') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
        <ImageOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
      </div>
    );
  }

  const currentSrc = stage === 'fallback' ? fallbackSrc : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local /public thumbnail; next/image+sharp not used in this app
    <img
      // Remount on src change so onError/ref re-fire for the fallback source.
      key={currentSrc}
      ref={(node) => {
        // An error that fires between the SSR-painted <img> and hydration is lost:
        // the onError handler isn't attached yet. Recover it on mount — a decoded
        // image that finished with zero width has already failed to load.
        if (node?.complete && node.naturalWidth === 0) advance();
      }}
      src={currentSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onError={advance}
      className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
    />
  );
}
