import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { ContactBookingForm } from '@/components/contact/ContactBookingForm';

export const metadata: Metadata = {
  title: 'Liên hệ đặt xe | BBVN',
  description: 'Đặt xe du lịch, thuê xe hợp đồng — để lại thông tin, BBVN tư vấn và báo giá nhanh.',
};

export default function ContactBookingPage() {
  const t = useTranslations('charter');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('page.title')}</h1>
        <p className="text-base text-muted-foreground">
          {t('page.subtitle')}
        </p>
      </div>

      <ContactBookingForm />
    </main>
  );
}
