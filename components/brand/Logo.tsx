import Image from 'next/image';
import { cn } from '@/lib/utils';

// String src + explicit intrinsic dims (not static imports): the CI type gate runs
// bare `tsc --noEmit` without next-env.d.ts image-module declarations.
const LOGOS = {
  combo: { src: '/brand/logo-horizontal.png', width: 959, height: 400 },
  comboMono: { src: '/brand/logo-horizontal-white.png', width: 983, height: 400 },
  glyph: { src: '/brand/logo-mark.png', width: 686, height: 678 },
  glyphMono: { src: '/brand/logo-mark-white.png', width: 566, height: 530 },
} as const;

export function Logo({
  variant = 'combo',
  mono = false,
  className,
}: {
  variant?: 'glyph' | 'combo';
  /** White-knockout variant for dark/orange surfaces. */
  mono?: boolean;
  className?: string;
}) {
  const logo =
    variant === 'glyph'
      ? mono
        ? LOGOS.glyphMono
        : LOGOS.glyph
      : mono
        ? LOGOS.comboMono
        : LOGOS.combo;

  return (
    <Image
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt="BBVN — Bus Booking"
      priority
      className={cn(variant === 'glyph' ? 'h-8 w-auto' : 'h-9 w-auto', 'shrink-0 self-start', className)}
    />
  );
}
