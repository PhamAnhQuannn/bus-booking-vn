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
      className="text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
    >
      {origin} → {destination}
    </h1>
  );
}
