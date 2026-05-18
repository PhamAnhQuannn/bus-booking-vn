/**
 * /booking/customer — Customer information step.
 *
 * Server component wrapper — rendering happens client-side via CustomerForm.
 */

import { CustomerForm } from './CustomerForm';

export default function CustomerPage() {
  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Thông tin hành khách</h1>
      <CustomerForm />
    </main>
  );
}
