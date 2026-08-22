import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';

/**
 * Segment not-found for /trips/[id] — rendered when getTripDetails() resolves to
 * null (trip missing, sales closed, departed, or operator not search-visible).
 * Gives a forward path back into search instead of a generic dead-end.
 */
export default function TripNotFound() {
  const t = useTranslations('trips');
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('notFound.eyebrow')}</p>
        <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('notFound.desc')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: 'default', size: 'lg' })}>
          {t('notFound.toSearch')}
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          {t('notFound.goHome')}
        </Link>
      </div>
    </main>
  );
}
