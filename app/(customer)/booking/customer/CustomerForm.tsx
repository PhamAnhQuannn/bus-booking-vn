'use client';

import { useActionState, useEffect, useRef, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useBookingStore } from '@/lib/state';
import { useHoldTimerStore } from '@/lib/state';
import { createHoldRequest } from '@/lib/api';
import { validatePickupSelection } from '@/lib/booking/pickupSelection';
import { getDisplayName } from '@/lib/auth/clientSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  const [pickupKind, setPickupKind] = useState<'station' | 'custom'>('station');
  const [pickupDetail, setPickupDetail] = useState('');
  const customDetailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !phoneInputRef.current) return;
    const saved = localStorage.getItem(LS_PHONE_KEY);
    if (saved) {
      phoneInputRef.current.value = saved;
    }
  }, []);

  useEffect(() => {
    const name = getDisplayName();
    if (name && buyerNameRef.current && !buyerNameRef.current.value) {
      buyerNameRef.current.value = name;
    }
  }, []);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: FormState, formData: FormData): Promise<FormState> => {
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

      const pickupCheck = validatePickupSelection({ kind: pickupKind, detail: pickupDetail });
      if (!pickupCheck.ok) {
        return {
          status: 'field_errors',
          errors: { pickup: 'Vui lòng ghi rõ địa chỉ đón (ít nhất 5 ký tự).' },
        };
      }

      const result = await createHoldRequest({
        tripId,
        ticketCount,
        buyerName: parsed.data.buyerName,
        buyerPhone: parsed.data.buyerPhone,
        buyerEmail: parsed.data.buyerEmail,
        pickupKind: pickupCheck.pickupKind,
        pickupDetail: pickupCheck.pickupKind === 'custom' ? pickupCheck.pickupDetail : undefined,
      });

      if (!result.ok) {
        if (result.code === 'SOLD_OUT') {
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

      localStorage.setItem(LS_PHONE_KEY, parsed.data.buyerPhone);

      setBuyerInfo(parsed.data.buyerName, parsed.data.buyerPhone, parsed.data.buyerEmail);
      setHold(result.holdId, result.expiresAt);
      startTimer(result.expiresAt);

      router.push(`/booking/review?holdId=${result.holdId}`);
      return { status: 'idle' };
    },
    { status: 'idle' } as FormState
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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

      <fieldset className="space-y-2" disabled={isPending}>
        <legend className="mb-1 text-sm font-medium">Điểm đón</legend>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pickupKind"
              value="station"
              checked={pickupKind === 'station'}
              onChange={() => {
                setPickupKind('station');
                setPickupDetail('');
              }}
              className="accent-primary"
            />
            <span className="text-sm">Đón tại bến xe</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pickupKind"
              value="custom"
              checked={pickupKind === 'custom'}
              onChange={() => {
                setPickupKind('custom');
                requestAnimationFrame(() => customDetailRef.current?.focus());
              }}
              className="accent-primary"
            />
            <span className="text-sm">Đón tận nơi</span>
          </label>
        </div>

        {pickupKind === 'custom' && (
          <div className="pt-1">
            <Label htmlFor="pickupDetail" className="mb-1">
              Địa chỉ đón
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
              Nhà xe sẽ gọi xác nhận địa chỉ đón với bạn.
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
