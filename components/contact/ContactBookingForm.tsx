'use client';

/**
 * ContactBookingForm — tourism / charter ("thuê xe hợp đồng") booking inquiry.
 *
 * Issue 082: wired to POST /api/charter. On a 201 we redirect to the confirmation
 * page with the returned ref. CSRF: echoes the bb_csrf cookie in X-CSRF-Token
 * (readCsrfToken) — the /lien-he-dat-xe GET issued the cookie via proxy.ts. A
 * hidden `company` honeypot field guards against bots (server drops a filled one).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { readCsrfToken } from '@/lib/auth';

export function ContactBookingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Earliest selectable departure = today (Asia/Ho_Chi_Minh); computed once for SSR stability.
  const [todayVN] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const str = (k: string) => String(data.get(k) ?? '').trim();
    const num = (k: string): number | null => {
      const v = str(k);
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const destination = str('destination');
    const passengers = num('people');
    if (passengers === null) {
      setError('Vui lòng nhập số người.');
      return;
    }

    const payload = {
      contactName: str('name'),
      contactPhone: str('phone'),
      contactEmail: str('email'),
      originName: str('origin'),
      destinationNames: destination ? [destination] : [],
      startDate: str('departureDate'),
      durationDays: num('days'),
      passengers,
      vehicleType: str('vehicle') || 'coach',
      notes: str('notes') || null,
      // Honeypot — hidden field, must stay empty.
      company: str('company'),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/charter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        const { ref } = (await res.json()) as { ref: string };
        router.push(`/lien-he-dat-xe/confirmation?ref=${encodeURIComponent(ref)}`);
        return;
      }
      // Honeypot drop returns 200 (no ref) — treat as success without a ref.
      if (res.status === 200) {
        router.push('/lien-he-dat-xe/confirmation');
        return;
      }
      if (res.status === 429) {
        setError('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
      } else {
        setError('Gửi yêu cầu thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } catch {
      setError('Có lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-label="Liên hệ đặt xe">
      {/* Honeypot: visually hidden, off the tab order, never read by humans. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Công ty</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Họ và tên</Label>
          <Input id="name" name="name" required placeholder="Nguyễn Văn A" autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input id="phone" name="phone" type="tel" required placeholder="0901234567" autoComplete="tel" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="ban@email.com" autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="origin">Điểm đón</Label>
          <Input id="origin" name="origin" required placeholder="vd: Thanh Hoá" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="destination">Điểm đến</Label>
          <Input id="destination" name="destination" required placeholder="vd: Sầm Sơn, Pù Luông…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="departureDate">Ngày khởi hành</Label>
          <DatePicker id="departureDate" name="departureDate" min={todayVN} placeholder="Chọn ngày đi" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="days">Số ngày</Label>
          <Input id="days" name="days" type="number" min={1} max={60} placeholder="vd: 2" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="people">Số người</Label>
          <Input id="people" name="people" type="number" min={1} max={100} required placeholder="vd: 16" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vehicle">Loại xe mong muốn (tuỳ chọn)</Label>
          <Input id="vehicle" name="vehicle" placeholder="vd: 16 chỗ, Limousine, giường nằm" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Ghi chú (tuỳ chọn)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder="Lịch trình, điểm đón, yêu cầu thêm…"
          className={cn(
            'min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm'
          )}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="w-full gap-2 sm:w-auto sm:self-start"
      >
        <Send className="size-4" aria-hidden="true" />
        {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </Button>
    </form>
  );
}
