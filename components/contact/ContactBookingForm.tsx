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
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { z } from 'zod';

import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { readCsrfToken } from '@/lib/auth/csrfClient';

export function ContactBookingForm() {
  const router = useRouter();
  const t = useTranslations('charter');
  // Audit F19: presence-first inline messages (localized VI/EN) — replaces the native
  // HTML5 `required` bubbles with the site's own inline error voice. Built per render
  // so the messages track the active locale.
  const contactSchema = z.object({
    name: z.string().trim().min(1, t('validation.reqName')),
    phone: z.string().trim().min(1, t('validation.reqPhone')),
    email: z.string().trim().min(1, t('validation.reqEmail')).email(t('validation.invalidEmail')),
    origin: z.string().trim().min(1, t('validation.reqOrigin')),
    destination: z.string().trim().min(1, t('validation.reqDestination')),
    departureDate: z.string().trim().min(1, t('validation.reqDate')),
    people: z.string().trim().min(1, t('validation.reqPeople')),
    vehicle: z.string().trim().min(1, t('validation.reqVehicle')),
  });
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
      setError(t('validation.reqPeopleNum'));
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
        setError(t('errors.rateLimit'));
      } else {
        setError(t('errors.submitFailed'));
      }
      inflightRef.current = false;
      setSubmitting(false);
    } catch {
      setError(t('errors.connError'));
      inflightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" aria-label={t('form.aria')}>
      {/* Honeypot: visually hidden, off the tab order, never read by humans. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">{t('form.honeypotCompany')}</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            {t('form.name')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="name" name="name" required placeholder={t('form.namePlaceholder')} autoComplete="name" aria-describedby={fieldErrors.name ? 'name-error' : undefined} />
          {fieldErrors.name && <p id="name-error" className="text-destructive text-sm mt-1">{fieldErrors.name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">
            {t('form.phone')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="phone" name="phone" type="tel" required placeholder={t('form.phonePlaceholder')} autoComplete="tel" aria-describedby={fieldErrors.phone ? 'phone-error' : undefined} />
          {fieldErrors.phone && <p id="phone-error" className="text-destructive text-sm mt-1">{fieldErrors.phone}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">
            {t('form.email')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="email" name="email" type="email" required placeholder={t('form.emailPlaceholder')} autoComplete="email" aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
          {fieldErrors.email && <p id="email-error" className="text-destructive text-sm mt-1">{fieldErrors.email}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="origin">
            {t('form.origin')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="origin" name="origin" required placeholder={t('form.originPlaceholder')} aria-describedby={fieldErrors.origin ? 'origin-error' : undefined} />
          {fieldErrors.origin && <p id="origin-error" className="text-destructive text-sm mt-1">{fieldErrors.origin}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="destination">
            {t('form.destination')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="destination" name="destination" required placeholder={t('form.destinationPlaceholder')} aria-describedby={fieldErrors.destination ? 'destination-error' : undefined} />
          {fieldErrors.destination && <p id="destination-error" className="text-destructive text-sm mt-1">{fieldErrors.destination}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="departureDate">
            {t('form.departureDate')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <DatePicker
            id="departureDate"
            name="departureDate"
            min={todayVN}
            placeholder={t('form.datePlaceholder')}
            aria-invalid={fieldErrors.departureDate ? true : undefined}
          />
          {fieldErrors.departureDate && (
            <p id="departureDate-error" className="text-destructive text-sm mt-1">{fieldErrors.departureDate}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="days">{t('form.days')}</Label>
          <Input id="days" name="days" type="number" min={1} max={60} placeholder={t('form.daysPlaceholder')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="people">
            {t('form.people')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="people" name="people" type="number" min={1} max={100} required placeholder={t('form.peoplePlaceholder')} aria-describedby={fieldErrors.people ? 'people-error' : undefined} />
          {fieldErrors.people && <p id="people-error" className="text-destructive text-sm mt-1">{fieldErrors.people}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vehicle">
            {t('form.vehicle')} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input
            id="vehicle"
            name="vehicle"
            required
            placeholder={t('form.vehiclePlaceholder')}
            aria-describedby={fieldErrors.vehicle ? 'vehicle-error' : undefined}
          />
          {fieldErrors.vehicle && <p id="vehicle-error" className="text-destructive text-sm mt-1">{fieldErrors.vehicle}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">{t('form.notes')}</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder={t('form.notesPlaceholder')}
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
        {submitting ? t('form.submitting') : t('form.submit')}
      </Button>
    </form>
  );
}
