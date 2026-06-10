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
  SelectGroup,
  SelectGroupLabel,
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

  // Issue 107/111: pickup selection. Areas fetched for this trip; default = station.
  const [areas, setAreas] = useState<{ areaId: string; label: string; kind: 'station' | 'pickup' }[]>(
    []
  );
  // Issue 112: distinguish loading / loaded(-empty) / error so we never silently
  // collapse "operator enabled zero areas" and "fetch failed" into a station-only picker.
  const [areasState, setAreasState] = useState<'loading' | 'loaded' | 'error'>('loading');
  // Issue 112: re-fetch trigger for the retry affordance.
  const [reloadKey, setReloadKey] = useState(0);
  const [pickupKind, setPickupKind] = useState<'station' | 'point' | 'custom'>('station');
  const [pickupAreaId, setPickupAreaId] = useState('');
  const [pickupDetail, setPickupDetail] = useState('');
  // Issue 112: client-side typeahead filter (only shown when >6 areas).
  const [areaQuery, setAreaQuery] = useState('');
  const customDetailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tripId) return;
    let active = true;
    // Note: 'loading' is the initial state and is re-asserted on retry via the catch/then below
    // rather than synchronously here (react-hooks/set-state-in-effect forbids a sync setState in the
    // effect body). A brief stale-state window on tripId change self-corrects when the fetch resolves.
    fetch(`/api/trips/${tripId}/pickup-areas`)
      .then((r) => {
        if (!r.ok) throw new Error(`pickup-areas ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!active) return;
        setAreas(d.areas ?? []);
        setAreasState('loaded');
      })
      .catch(() => {
        if (active) setAreasState('error');
      });
    return () => {
      active = false;
    };
  }, [tripId, reloadKey]);

  // Issue 112: typeahead filter over the grouped option labels (case-insensitive substring).
  const normalizedQuery = areaQuery.trim().toLowerCase();
  const showAreaFilter = areas.length > 6;
  const visibleAreas =
    showAreaFilter && normalizedQuery
      ? areas.filter((a) => a.label.toLowerCase().includes(normalizedQuery))
      : areas;

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

      // Issue 107/111: validate the pickup selection before holding. point = named stop with an
      // optional note; custom = off-list request with a REQUIRED ≥5-char location.
      const pickupCheck = validatePickupSelection(
        areas.map((a) => a.areaId),
        { kind: pickupKind, areaId: pickupAreaId, detail: pickupDetail }
      );
      if (!pickupCheck.ok) {
        const msg =
          pickupCheck.code === 'pickup_custom_detail_required'
            ? 'Vui lòng ghi rõ địa chỉ đón (ít nhất 5 ký tự).'
            : 'Vui lòng chọn điểm đón hợp lệ.';
        return { status: 'field_errors', errors: { pickup: msg } };
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
          pickupCheck.pickupKind === 'point'
            ? (pickupCheck.pickupDetail ?? undefined)
            : pickupCheck.pickupKind === 'custom'
              ? pickupCheck.pickupDetail
              : undefined,
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

      {/* Issue 107/111: pickup selection (required) — station / grouped points / custom request */}
      <fieldset className="space-y-2" disabled={isPending}>
        <legend className="mb-1 text-sm font-medium">Điểm đón</legend>

        {/* Issue 112: surface fetch failure with a retry instead of silently showing station-only. */}
        {areasState === 'error' && (
          <div
            role="alert"
            data-testid="pickup-fetch-error"
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-warning-border bg-warning p-2 text-sm text-warning-foreground"
          >
            <span>Không tải được danh sách điểm đón. Bạn vẫn có thể đón tại bến hoặc ghi rõ điểm đón khác.</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="font-medium underline underline-offset-2"
              data-testid="pickup-fetch-retry"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Issue 112: genuine empty (operator enabled zero areas) — not the same as a fetch error. */}
        {areasState === 'loaded' && areas.length === 0 && (
          <p className="text-muted-foreground text-sm" data-testid="pickup-empty">
            Chuyến này chỉ đón tại bến xe.
          </p>
        )}

        {/* Issue 112: typeahead for long lists (>6 areas); usable at 360px (full-width input). */}
        {showAreaFilter && (
          <Input
            type="text"
            value={areaQuery}
            onChange={(e) => setAreaQuery(e.target.value)}
            placeholder="Tìm điểm đón..."
            aria-label="Tìm điểm đón"
            data-testid="pickup-filter"
            className="w-full"
          />
        )}

        <Select
          value={pickupKind === 'station' ? 'station' : pickupKind === 'custom' ? '__custom__' : pickupAreaId}
          onValueChange={(v: string | null) => {
            if (!v || v === 'station') {
              setPickupKind('station');
              setPickupAreaId('');
              setPickupDetail('');
            } else if (v === '__custom__') {
              setPickupKind('custom');
              setPickupAreaId('');
              setPickupDetail('');
              // a11y: move focus to the revealed required input.
              requestAnimationFrame(() => customDetailRef.current?.focus());
            } else {
              setPickupKind('point');
              setPickupAreaId(v);
              setPickupDetail('');
            }
          }}
          disabled={isPending}
        >
          <SelectTrigger data-testid="pickup-select" aria-label="Điểm đón">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="station">Tại bến xe</SelectItem>
            {visibleAreas.some((a) => a.kind === 'station') && (
              <SelectGroup>
                <SelectGroupLabel>Bến xe</SelectGroupLabel>
                {visibleAreas
                  .filter((a) => a.kind === 'station')
                  .map((a) => (
                    <SelectItem key={a.areaId} value={a.areaId}>
                      {a.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            )}
            {visibleAreas.some((a) => a.kind === 'pickup') && (
              <SelectGroup>
                <SelectGroupLabel>Đón tận nơi</SelectGroupLabel>
                {visibleAreas
                  .filter((a) => a.kind === 'pickup')
                  .map((a) => (
                    <SelectItem key={a.areaId} value={a.areaId}>
                      {a.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            )}
            <SelectItem value="__custom__">Điểm đón khác (ghi rõ)</SelectItem>
          </SelectContent>
        </Select>

        {pickupKind === 'point' && (
          <div className="pt-1">
            <Label htmlFor="pickupDetail" className="mb-1">
              Ghi chú cho tài xế (số nhà, gọi trước...)
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

        {pickupKind === 'custom' && (
          <div className="pt-1">
            <Label htmlFor="pickupDetail" className="mb-1">
              Địa chỉ đón mong muốn
            </Label>
            <Input
              ref={customDetailRef}
              id="pickupDetail"
              type="text"
              value={pickupDetail}
              onChange={(e) => setPickupDetail(e.target.value)}
              placeholder="VD: số 12 Lê Lợi, phường X (ít nhất 5 ký tự)"
              data-testid="pickup-custom-detail"
              required
              aria-required="true"
              aria-invalid={fieldErrors.pickup ? true : undefined}
              aria-describedby={`pickup-custom-help${fieldErrors.pickup ? ' pickup-error' : ''}`}
            />
            <p id="pickup-custom-help" className="text-muted-foreground text-xs mt-1">
              Điểm đón này chưa được nhà xe xác nhận. Nhà xe sẽ gọi xác nhận với bạn.
            </p>
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
