'use client';

import { useEffect, useState } from 'react';

/**
 * useIsWide — true khi viewport ≥ 1280px (áp flow 3-pha mới). SSR-safe:
 * init `false` (không đọc matchMedia trong initializer → tránh hydration mismatch),
 * nâng cấp trong effect. Trên màn rộng có 1 frame narrow-flash — chấp nhận.
 */
export function useIsWide(query = '(min-width:1280px)'): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return wide;
}
