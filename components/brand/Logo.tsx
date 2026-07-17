import Image from 'next/image';
import { cn } from '@/lib/utils';
import logoHorizontal from '@/public/brand/logo-horizontal.png';
import logoHorizontalWhite from '@/public/brand/logo-horizontal-white.png';
import logoMark from '@/public/brand/logo-mark.png';
import logoMarkWhite from '@/public/brand/logo-mark-white.png';

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
  const src =
    variant === 'glyph'
      ? mono
        ? logoMarkWhite
        : logoMark
      : mono
        ? logoHorizontalWhite
        : logoHorizontal;

  return (
    <Image
      src={src}
      alt="BBVN — Bus Booking"
      priority
      className={cn(variant === 'glyph' ? 'h-8 w-auto' : 'h-9 w-auto', 'shrink-0 self-start', className)}
    />
  );
}
