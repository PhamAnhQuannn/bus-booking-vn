import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({
  variant = 'combo',
  mono = false,
  className,
}: {
  variant?: 'glyph' | 'combo';
  mono?: boolean;
  className?: string;
}) {
  const isGlyph = variant === 'glyph';
  const w = isGlyph ? 32 : 120;
  const h = isGlyph ? 32 : 48;
  const sizeClass = isGlyph ? 'size-8' : 'h-10 w-auto';
  const filterClass = mono ? 'brightness-0 invert' : '';

  if (isGlyph || mono) {
    return (
      <span className={cn('inline-flex items-center', className)} aria-label="BBVN">
        <Image
          src={isGlyph ? '/icons/icon-192.png' : '/logo-light.png'}
          alt="BBVN"
          width={w}
          height={h}
          className={cn(sizeClass, filterClass)}
          priority
        />
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center', className)} aria-label="BBVN">
      <Image
        src="/logo-light.png"
        alt="BBVN"
        width={w}
        height={h}
        className={cn(sizeClass, 'dark:hidden')}
        priority
      />
      <Image
        src="/logo-dark.png"
        alt="BBVN"
        width={w}
        height={h}
        className={cn(sizeClass, 'hidden dark:block')}
        priority
      />
    </span>
  );
}
