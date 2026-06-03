/**
 * /booking/customer — Customer information step.
 *
 * Server component wrapper — rendering happens client-side via CustomerForm.
 */

import { CustomerForm } from './CustomerForm';
import { BookingSteps } from '@/components/booking/BookingSteps';

export default function CustomerPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <BookingSteps current={1} />
      <h1 className="text-2xl font-bold">Thông tin hành khách</h1>
      <CustomerForm />
    </main>
  );
}
