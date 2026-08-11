/**
 * /booking/review — retired.
 *
 * The customer-info + review/confirm steps were merged into /booking/customer
 * (the "Xác nhận thông tin & thanh toán" page). This transitional stub redirects
 * any straggler (bookmark, in-flight hold from a prior deploy) home rather than
 * 404-ing. Remove after one release.
 */

import { redirect } from 'next/navigation';

export default function ReviewRedirect() {
  redirect('/');
}
