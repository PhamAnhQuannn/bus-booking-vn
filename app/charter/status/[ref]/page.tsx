/**
 * /charter/status/[ref] — public charter request status (Issue 082).
 *
 * Server component: reads the CharterRequest by ref in-process (getCharterByRef) —
 * NEVER self-fetches its own API (Mistake Log 2026-05-17). notFound() when no row
 * matches.
 *
 * REF AS ACCESS KEY: the ref is a random CH-YYYY-XXXXXX (36^6 ≈ 2.1B/year), hard to
 * enumerate. For a lead-gen request (no payment; the only data shown is what the
 * customer themselves submitted) a ref-only key is acceptable — no session gate.
 *
 * Status mapping (customer-facing label):
 *   ADMIN_REVIEW / ASSIGNED_DIRECT / PUBLISHED → "đang tìm nhà xe"
 *   ACCEPTED                                    → "đã ghép nhà xe" (+ operator contact)
 *   COMPLETED                                   → "hoàn tất"
 *   CANCELLED                                   → "đã hủy"
 *   REJECTED / EXPIRED / DECLINED               → "không thể xử lý"
 *
 * The CancelCharterButton (customer cancel) is rendered only when the status is in
 * the pre-ACCEPT cancellable set (CUSTOMER_CANCELLABLE_STATUSES).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, Phone, Users } from 'lucide-react';
import type { CharterStatus } from '@prisma/client';

import { prisma } from '@/lib/core/db/client';
import { getCharterByRef, CUSTOMER_CANCELLABLE_STATUSES } from '@/lib/charter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CancelCharterButton } from '@/components/charter/CancelCharterButton';

export const metadata: Metadata = {
  title: 'Trạng thái yêu cầu thuê xe | BBVN',
  robots: { index: false },
};

interface StatusPageProps {
  params: Promise<{ ref: string }>;
}

type Tone = 'pending' | 'success' | 'neutral' | 'danger';

const STATUS_LABEL: Record<CharterStatus, string> = {
  SUBMITTED: 'Đang tìm nhà xe',
  ADMIN_REVIEW: 'Đang tìm nhà xe',
  ASSIGNED_DIRECT: 'Đang tìm nhà xe',
  PUBLISHED: 'Đang tìm nhà xe',
  ACCEPTED: 'Đã ghép nhà xe',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Không thể xử lý',
  EXPIRED: 'Không thể xử lý',
  DECLINED: 'Đang tìm nhà xe',
};

const STATUS_TONE: Record<CharterStatus, Tone> = {
  SUBMITTED: 'pending',
  ADMIN_REVIEW: 'pending',
  ASSIGNED_DIRECT: 'pending',
  PUBLISHED: 'pending',
  ACCEPTED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  REJECTED: 'danger',
  EXPIRED: 'danger',
  DECLINED: 'pending',
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export default async function CharterStatusPage({ params }: StatusPageProps) {
  const { ref } = await params;

  const charter = await getCharterByRef(prisma, ref);
  if (!charter) {
    notFound();
  }

  const cancellable = CUSTOMER_CANCELLABLE_STATUSES.has(charter.status);
  const route = [charter.originName, ...charter.destinations].filter(Boolean).join(' → ');

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Mã yêu cầu</span>
          <span className="font-mono text-2xl font-bold tracking-widest text-primary">{charter.ref}</span>
        </div>
        <Badge variant={STATUS_TONE[charter.status]}>{STATUS_LABEL[charter.status]}</Badge>
      </header>

      {charter.status === 'ACCEPTED' && charter.operator && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Nhà xe phụ trách</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Nhà xe</dt>
                <dd className="font-medium">{charter.operator.legalName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" aria-hidden="true" />
                  Hotline
                </dt>
                <dd className="text-right">
                  <a href={`tel:${charter.operator.contactPhone}`} className="font-mono text-primary hover:underline">
                    {charter.operator.contactPhone}
                  </a>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Thông tin yêu cầu</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4" aria-hidden="true" />
                Hành trình
              </dt>
              <dd className="text-right font-medium">{route || '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden="true" />
                Ngày đi
              </dt>
              <dd>
                {formatDate(charter.startDate)}
                {charter.durationDays ? ` · ${charter.durationDays} ngày` : ''}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" aria-hidden="true" />
                Số người
              </dt>
              <dd>{charter.passengers}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại xe</dt>
              <dd>{charter.vehicleType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Liên hệ</dt>
              <dd className="font-mono">{charter.contactPhone}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {cancellable && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Bạn có thể hủy yêu cầu trong khi chúng tôi đang tìm nhà xe phù hợp.
          </p>
          <CancelCharterButton charterRef={charter.ref} />
        </div>
      )}
    </main>
  );
}
