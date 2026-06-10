'use client';

/**
 * CustomerForm — client component for the buyer info step.
 *
 * - Pre-fills buyerPhone from localStorage (key: busbooking_last_phone).
 * - Client-side Zod validation before submit.
 * - Submits to POST /api/holds via createHoldRequest().
 * - On success: saves phone to localStorage, updates stores, navigates to /booking/review.
 * - On 409 SOLD_OUT: shows error toast + sets soldOut state.
 * - On 429: shows retry-after message.
 * - Uses useActionState from 'react' (Next 16 / React 19).
 */

import { useActionState, useEffect, useRef, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useBookingStore } from '@/lib/state';
import { useHoldTimerStore } from '@/lib/state';
import { createHoldRequest } from '@/lib/api';
// Deep client-safe import (pure validator; barrel would pull the server graph — Issue 092b).
import { validatePickupSelection } from '@/lib/booking/pickupSelection';
import { getDisplayName, getCustomerPhone } from '@/app/(customer)/auth/register/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LS_PHONE_KEY = 'busbooking_last_phone';

const clientSchema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(4, 'Họ tên phải có ít nhất 4 ký tự')
    .max(100, 'Họ tên không được vượt quá 100 ký tự')
    .regex(/^[\p{L}\p{M}\s'.-]+$/u, 'Họ tên chỉ được chứa chữ cái, dấu cách và các ký tự hợp lệ'),
  buyerPhone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[35789][0-9]{8}$/, 'Số điện thoại không hợp lệ'),
  buyerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Vui lòng nhập email để nhận vé')
    .max(254, 'Email không được vượt quá 254 ký tự')
    .email('Email không hợp lệ'),
});

type FormState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'submitting' }
  | { status: 'sold_out' }
  | { status: 'rate_limited'; retryAfter: number }
  | { status: 'error'; message: string }
  | { status: 'field_errors'; errors: Record<string, string> };

type FormData = {
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
};

export function CustomerForm() {
  const router = useRouter();
  const { tripId, ticketCount, setHold, setBuyerInfo } = useBookingStore();
  const { startTimer } = useHoldTimerStore();
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const buyerNameRef = useRef<HTMLInputElement>(null);

  // Issue 107: pickup selection. Areas fetched for this trip; default = station.
  const [areas, setAreas] = useState<{ areaId: string; label: string }[]>([]);
  const [pickupKind, setPickupKind] = useState<'station' | 'point'>('station');
  const [pickupAreaId, setPickupAreaId] = useState('');
  const [pickupDetail, setPickupDetail] = useState('');

  useEffect(() => {
    if (!tripId) return;
    let active = true;
    fetch(`/api/trips/${tripId}/pickup-areas`)
      .then((r) => (r.ok ? r.json() : { areas: [] }))
      .then((d) => {
        if (active) setAreas(d.areas ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tripId]);

  // Pre-fill phone: a signed-in customer's registered account phone wins
  // (Issue 030); otherwise fall back to the last-typed phone from localStorage
  // (guest convenience). Field stays editable — this only seeds the value.
  useEffect(() => {
    if (typeof window === 'undefined' || !phoneInputRef.current) return;
    const accountPhone = getCustomerPhone();
    const saved = accountPhone ?? localStorage.getItem(LS_PHONE_KEY);
    if (saved) {
      phoneInputRef.current.value = saved;
    }
  }, []);

  // Pre-fill buyer name from the logged-in customer's display name (AC4).
  // Field stays editable — this only seeds the initial value.
  useEffect(() => {
    const name = getDisplayName();
    if (name && buyerNameRef.current && !buyerNameRef.current.value) {
      buyerNameRef.current.value = name;
    }
  }, []);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: FormState, formData: FormData): Promise<FormState> => {
      // Client-side validation
      const parsed = clientSchema.safeParse(formData);
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          if (key) errors[key] = issue.message;
        }
        return { status: 'field_errors', errors };
      }

      if (!tripId || !ticketCount) {
        return { status: 'error', message: 'Thông tin chuyến xe bị thiếu. Vui lòng chọn lại.' };
      }

      // Issue 107: validate the pickup selection before holding. The named point is the
      // location; the detail note is optional.
      const pickupCheck = validatePickupSelection(
        areas.map((a) => a.areaId),
        { kind: pickupKind, areaId: pickupAreaId, detail: pickupDetail }
      );
      if (!pickupCheck.ok) {
        return { status: 'field_errors', errors: { pickup: 'Vui lòng chọn điểm đón hợp lệ.' } };
      }

      const result = await createHoldRequest({
        tripId,
        ticketCount,
        buyerName: parsed.data.buyerName,
        buyerPhone: parsed.data.buyerPhone,
        buyerEmail: parsed.data.buyerEmail,
        pickupKind: pickupCheck.pickupKind,
        pickupAreaId: pickupCheck.pickupKind === 'point' ? pickupCheck.pickupAreaId : undefined,
        pickupDetail:
          pickupCheck.pickupKind === 'point' ? (pickupCheck.pickupDetail ?? undefined) : undefined,
      });

      if (!result.ok) {
        if (result.code === 'SOLD_OUT') {
          // Invalidate App Router cache so stale seat counts are not shown.
          // No client-side search store exists; router.refresh() covers RSC cache.
          router.refresh();
          return { status: 'sold_out' };
        }
        if (result.code === 'TOO_MANY_REQUESTS') {
          return { status: 'rate_limited', retryAfter: result.retryAfter ?? 60 };
        }
        if (result.code === 'PICKUP_INVALID') {
          return { status: 'field_errors', errors: { pickup: 'Điểm đón không hợp lệ. Vui lòng chọn lại.' } };
        }
        return { status: 'error', message: 'Có lỗi xảy ra. Vui lòng thử lại.' };
      }

      // Save phone for next time
      localStorage.setItem(LS_PHONE_KEY, parsed.data.buyerPhone);

      // Update stores
      setBuyerInfo(parsed.data.buyerName, parsed.data.buyerPhone, parsed.data.buyerEmail);
      setHold(result.holdId, result.expiresAt);
      startTimer(result.expiresAt);

      // Navigate to review
      router.push(`/booking/review?holdId=${result.holdId}`);
      return { status: 'idle' };
    },
    { status: 'idle' } as FormState
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // useActionState dispatch must run inside a transition (React 19) — calling
    // formAction directly from the onSubmit handler logs "An async function with
    // useActionState was called outside of a transition".
    startTransition(() => {
      formAction({
        buyerName: (fd.get('buyerName') as string) ?? '',
        buyerPhone: (fd.get('buyerPhone') as string) ?? '',
        buyerEmail: (fd.get('buyerEmail') as string) ?? '',
      });
    });
  }

  const fieldErrors =
    state.status === 'field_errors' ? state.errors : {};

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <Label htmlFor="buyerName" className="mb-1">
          Họ và tên
        </Label>
        <Input
          id="buyerName"
          name="buyerName"
          type="text"
          required
          ref={buyerNameRef}
          disabled={isPending}
          aria-describedby={fieldErrors.buyerName ? 'buyerName-error' : undefined}
        />
        {fieldErrors.buyerName && (
          <p id="buyerName-error" className="text-destructive text-sm mt-1">
            {fieldErrors.buyerName}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="buyerPhone" className="mb-1">
          Số điện thoại
        </Label>
        <Input
          id="buyerPhone"
          name="buyerPhone"
          type="tel"
          required
          ref={phoneInputRef}
          disabled={isPending}
          aria-describedby={fieldErrors.buyerPhone ? 'buyerPhone-error' : undefined}
        />
        {fieldErrors.buyerPhone && (
          <p id="buyerPhone-error" className="text-destructive text-sm mt-1">
            {fieldErrors.buyerPhone}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="buyerEmail" className="mb-1">
          Email
        </Label>
        <Input
          id="buyerEmail"
          name="buyerEmail"
          type="email"
          required
          disabled={isPending}
          aria-describedby={fieldErrors.buyerEmail ? 'buyerEmail-error' : undefined}
        />
        {fieldErrors.buyerEmail && (
          <p id="buyerEmail-error" className="text-destructive text-sm mt-1">
            {fieldErrors.buyerEmail}
          </p>
        )}
      </div>

      {/* Issue 107: pickup selection (required) */}
      <fieldset className="space-y-2" disabled={isPending}>
        <legend className="mb-1 text-sm font-medium">Điểm đón</legend>
        <Select
          value={pickupKind === 'station' ? 'station' : pickupAreaId}
          onValueChange={(v: string | null) => {
            if (!v || v === 'station') {
              setPickupKind('station');
              setPickupAreaId('');
            } else {
              setPickupKind('point');
              setPickupAreaId(v);
            }
          }}
          disabled={isPending}
        >
          <SelectTrigger data-testid="pickup-select" aria-label="Điểm đón">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="station">Tại bến xe</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.areaId} value={a.areaId}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {pickupKind === 'point' && (
          <div className="pt-1">
            <Label htmlFor="pickupDetail" className="mb-1">
              Ghi chú điểm đón (tuỳ chọn)
            </Label>
            <Input
              id="pickupDetail"
              type="text"
              value={pickupDetail}
              onChange={(e) => setPickupDetail(e.target.value)}
              placeholder="VD: đứng trước cổng, gọi trước khi đến"
              data-testid="pickup-detail"
              aria-describedby={fieldErrors.pickup ? 'pickup-error' : undefined}
            />
          </div>
        )}
        {fieldErrors.pickup && (
          <p id="pickup-error" className="text-destructive text-sm mt-1">
            {fieldErrors.pickup}
          </p>
        )}
      </fieldset>

      {state.status === 'sold_out' && (
        <div role="alert" className="bg-destructive/10 border border-destructive/30 rounded p-3 text-destructive">
          Chuyến xe này đã hết chỗ. Vui lòng chọn chuyến khác.
        </div>
      )}

      {state.status === 'rate_limited' && (
        <div role="alert" className="bg-warning border border-warning-border rounded p-3 text-warning-foreground">
          Quá nhiều yêu cầu. Vui lòng thử lại sau {state.retryAfter} giây.
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="bg-destructive/10 border border-destructive/30 rounded p-3 text-destructive">
          {state.message}
        </div>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? 'Đang xử lý...' : 'Tiếp tục'}
      </Button>
    </form>
  );
}
