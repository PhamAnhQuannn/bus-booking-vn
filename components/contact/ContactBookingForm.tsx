'use client';

/**
 * ContactBookingForm — tourism / charter ("thuê xe hợp đồng") booking inquiry.
 *
 * Issue 082: wired to POST /api/charter. On a 201 we redirect to the confirmation
 * page with the returned ref. CSRF: echoes the bb_csrf cookie in X-CSRF-Token
 * (readCsrfToken) — the /lien-he-dat-xe GET issued the cookie via proxy.ts. A
 * hidden `company` honeypot field guards against bots (server drops a filled one).
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { readCsrfToken } from '@/lib/auth/csrfClient';

// Audit F19: presence-first Vietnamese messages, same pattern as CustomerForm's
// clientSchema (F8) — replaces the native HTML5 `required` bubbles (English,
// off-brand) with the site's own inline error voice.
const contactSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại'),
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  origin: z.string().trim().min(1, 'Vui lòng nhập điểm đón'),
  destination: z.string().trim().min(1, 'Vui lòng nhập điểm đến'),
  departureDate: z.string().trim().min(1, 'Vui lòng chọn ngày khởi hành'),
  people: z.string().trim().min(1, 'Vui lòng nhập số người'),
  vehicle: z.string().trim().min(1, 'Vui lòng chọn loại xe'),
});

export function ContactBookingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Audit F26: synchronous re-entry guard. `submitting` state is async — a second
  // click dispatched before React re-renders still enters this handler. A ref is
  // checked/set synchronously before any await, closing that window.
  const inflightRef = useRef(false);
  // Earliest selectable departure = today (Asia/Ho_Chi_Minh); computed once for SSR stability.
  const [todayVN] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inflightRef.current) return;
    inflightRef.current = true;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const form = e.currentTarget;
    const data = new FormData(form);

    const str = (k: string) => String(data.get(k) ?? '').trim();
    const num = (k: string): number | null => {
      const v = str(k);
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const parsed = contactSchema.safeParse({
      name: str('name'),
      phone: str('phone'),
      email: str('email'),
      origin: str('origin'),
      destination: str('destination'),
      departureDate: str('departureDate'),
      people: str('people'),
      vehicle: str('vehicle'),
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        // First issue per field wins (presence check is ordered ahead of the
        // email format check) — an empty field must surface "required", not a
        // later format message.
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      inflightRef.current = false;
      setSubmitting(false);
      return;
    }

    const destination = str('destination');
    const passengers = num('people');
    if (passengers === null) {
      setError('Vui lòng nhập số người.');
      inflightRef.current = false;
      setSubmitting(false);
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
      vehicleType: str('vehicle'),
      notes: str('notes') || null,
      // Honeypot — hidden field, must stay empty.
      company: str('company'),
    };

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
        // Success: guard stays locked (not released) through the navigation —
        // there is no "resubmit" affordance to re-enable on this path.
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
      inflightRef.current = false;
      setSubmitting(false);
    } catch {
      setError('Có lỗi kết nối. Vui lòng thử lại.');
      inflightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" aria-label="Liên hệ đặt xe">
      {/* Honeypot: visually hidden, off the tab order, never read by humans. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Công ty</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            Họ và tên <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="name" name="name" required placeholder="Nguyễn Văn A" autoComplete="name" aria-describedby={fieldErrors.name ? 'name-error' : undefined} />
          {fieldErrors.name && <p id="name-error" className="text-destructive text-sm mt-1">{fieldErrors.name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">
            Số điện thoại <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="phone" name="phone" type="tel" required placeholder="0901234567" autoComplete="tel" aria-describedby={fieldErrors.phone ? 'phone-error' : undefined} />
          {fieldErrors.phone && <p id="phone-error" className="text-destructive text-sm mt-1">{fieldErrors.phone}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">
            Email <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="email" name="email" type="email" required placeholder="ban@email.com" autoComplete="email" aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
          {fieldErrors.email && <p id="email-error" className="text-destructive text-sm mt-1">{fieldErrors.email}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="origin">
            Điểm đón <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="origin" name="origin" required placeholder="vd: Thanh Hoá" aria-describedby={fieldErrors.origin ? 'origin-error' : undefined} />
          {fieldErrors.origin && <p id="origin-error" className="text-destructive text-sm mt-1">{fieldErrors.origin}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="destination">
            Điểm đến <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="destination" name="destination" required placeholder="vd: Sầm Sơn, Pù Luông…" aria-describedby={fieldErrors.destination ? 'destination-error' : undefined} />
          {fieldErrors.destination && <p id="destination-error" className="text-destructive text-sm mt-1">{fieldErrors.destination}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="departureDate">
            Ngày khởi hành <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <DatePicker
            id="departureDate"
            name="departureDate"
            min={todayVN}
            placeholder="Chọn ngày đi"
            aria-invalid={fieldErrors.departureDate ? true : undefined}
          />
          {fieldErrors.departureDate && (
            <p id="departureDate-error" className="text-destructive text-sm mt-1">{fieldErrors.departureDate}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="days">Số ngày (tuỳ chọn)</Label>
          <Input id="days" name="days" type="number" min={1} max={60} placeholder="vd: 2" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="people">
            Số người <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="people" name="people" type="number" min={1} max={100} required placeholder="vd: 16" aria-describedby={fieldErrors.people ? 'people-error' : undefined} />
          {fieldErrors.people && <p id="people-error" className="text-destructive text-sm mt-1">{fieldErrors.people}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vehicle">
            Loại xe mong muốn <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input
            id="vehicle"
            name="vehicle"
            required
            placeholder="vd: 16 chỗ, Limousine, giường nằm"
            aria-describedby={fieldErrors.vehicle ? 'vehicle-error' : undefined}
          />
          {fieldErrors.vehicle && <p id="vehicle-error" className="text-destructive text-sm mt-1">{fieldErrors.vehicle}</p>}
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
        className="w-full gap-2 bg-primary-strong hover:bg-primary-strong/90 sm:w-auto sm:self-start"
      >
        <Send className="size-4" aria-hidden="true" />
        {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </Button>
    </form>
  );
}
