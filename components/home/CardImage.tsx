'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Generic scenic fallback for a card whose own /destinations/<slug>.jpg is missing
 * (e.g. a boarding town without its own photo). A real photo beats the neutral
 * "broken" tile. This is a full-res hero JPG served as a plain <img> — the marketing
 * landing hero renders a DIFFERENT asset through next/image, so this is one extra
 * download the first time a fallback card appears; it's then browser-cached and
 * reused across every other fallback card on the page. If even this fails, we fall
 * to the ImageOff tile.
 */
const FALLBACK_SRC = '/hero/landing-golden-1920.jpg';

export function CardImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  // primary photo → generic fallback photo → neutral tile (last resort).
  const [stage, setStage] = useState<'primary' | 'fallback' | 'tile'>('primary');
  // Advance keyed to the stage that failed, so a double-fire (mount ref-check AND
  // onError on the same node) can't collapse primary straight to the tile and skip
  // the scenic fallback — the whole point of this component.
  const failed = (from: 'primary' | 'fallback') =>
    setStage((s) => (s !== from ? s : from === 'primary' ? 'fallback' : 'tile'));

  if (stage === 'tile') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
        <ImageOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
      </div>
    );
  }

  const currentSrc = stage === 'fallback' ? FALLBACK_SRC : src;
  const failStage = stage === 'fallback' ? 'fallback' : 'primary';

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local /public thumbnail; next/image+sharp not used in this app
    <img
      // Remount on src change so onError/ref re-fire for the fallback source.
      key={currentSrc}
      ref={(node) => {
        // An error that fires between the SSR-painted <img> and hydration is lost:
        // the onError handler isn't attached yet. Recover it on mount — a decoded
        // image that finished with zero width has already failed to load.
        if (node?.complete && node.naturalWidth === 0) failed(failStage);
      }}
      src={currentSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onError={() => failed(failStage)}
      className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
    />
  );
}
