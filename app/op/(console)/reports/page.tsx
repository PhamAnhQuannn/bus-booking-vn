/**
 * /op/reports — index redirect.
 *
 * No standalone reports landing exists; the per-bus overview is the canonical
 * entry. Some render/link paths (and external crawlers) hit the bare
 * /op/reports — without this page that 404s. Redirect to the overview so the
 * parent path is always valid. The (console) layout already gates auth.
 */

import { redirect } from 'next/navigation';

export default function ReportsIndexPage() {
  redirect('/op/reports/overview');
}
