'use client';

import { useEffect, useRef } from 'react';

export function ResultsHeading({ origin, destination }: { origin: string; destination: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className="rounded-sm font-display text-3xl font-extrabold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-4xl md:text-5xl"
    >
      {origin} <span className="text-primary-strong">↔ {destination}</span>
    </h1>
  );
}
