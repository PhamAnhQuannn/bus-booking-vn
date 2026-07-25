'use client';

import { useActionState, useEffect, useRef, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useBookingStore } from '@/lib/state';
import { useHoldTimerStore } from '@/lib/state';
import { createHoldRequest } from '@/lib/api';
import { validatePickupSelection } from '@/lib/booking/pickupSelection';
import { suggestEmail } from '@/lib/booking/emailSuggest';
import { getDisplayName } from '@/lib/auth/clientSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PHONE_STORAGE_KEY = 'busbooking_last_phone';

const clientSchema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập họ tên')
    .min(4, 'Họ tên phải có ít nhất 4 ký tự')
    .max(100, 'Họ tên không được vượt quá 100 ký tự')
    .regex(/^[\p{L}\p{M}\s'.-]+$/u, 'Họ tên chỉ được chứa chữ cái, dấu cách và các ký tự hợp lệ'),
  buyerPhone: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập số điện thoại')
    .regex(
      /^(0|\+84)[35789][0-9]{8}$/,
      'Số điện thoại không hợp lệ. Nhập số di động Việt Nam 10 chữ số bắt đầu bằng 0 hoặc +84, VD: 0912345678.',
    ),
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
  | { status: 'field_errors'; errors: Record<string, string>; suggestion?: string };

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
  const emailRef = useRef<HTMLInputElement>(null);

  // Typo-suggestion state ("did you mean gmail.com?") + soft-gate acknowledgement.
  // emailAckRef holds the exact value the user already chose to keep despite a
  // suggestion, so a second submit of that same value proceeds.
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const emailAckRef = useRef<string | null>(null);

  const [pickupKind, setPickupKind] = useState<'station' | 'custom'>('station');
  const [pickupDetail, setPickupDetail] = useState('');
  const customDetailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !phoneInputRef.current) return;
    const saved = sessionStorage.getItem(PHONE_STORAGE_KEY);
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
          // First issue per field wins (presence checks are ordered ahead of
          // format checks above) — an empty field must surface "required",
          // not the format message a later regex/refine check also raises.
          if (key && !errors[key]) errors[key] = issue.message;
        }
        return { status: 'field_errors', errors };
      }

      if (!tripId || !ticketCount) {
        return { status: 'error', message: 'Thông tin chuyến xe bị thiếu. Vui lòng chọn lại.' };
      }

      // Soft-gate on a likely email typo. The ticket is delivered by email, so a
      // wrong domain means the customer never gets it. Nudge ONCE: if the email
      // looks like a typo and the user hasn't already chosen to keep this exact
      // value, show the suggestion and stop. A second submit of the same value
      // (emailAckRef matches) proceeds — real-but-unusual domains still get through.
      const emailValue = parsed.data.buyerEmail;
      const suggestion = suggestEmail(emailValue);
      if (suggestion && emailAckRef.current !== emailValue) {
        emailAckRef.current = emailValue;
        return {
          status: 'field_errors',
          errors: {
            buyerEmail: `Email có thể bị sai. Có phải bạn muốn nhập ${suggestion}? Kiểm tra lại, hoặc nhấn "Tiếp tục" lần nữa để giữ ${emailValue}.`,
          },
          suggestion,
        };
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

      sessionStorage.setItem(PHONE_STORAGE_KEY, parsed.data.buyerPhone);

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

  // Suggestion to surface: from the blur check, or from a submit-time soft-gate.
  const activeSuggestion =
    emailSuggestion ?? (state.status === 'field_errors' ? state.suggestion : undefined);

  function acceptSuggestion() {
    if (!activeSuggestion || !emailRef.current) return;
    emailRef.current.value = activeSuggestion;
    emailAckRef.current = activeSuggestion; // now a correct address; won't re-nudge
    setEmailSuggestion(null);
  }

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
          placeholder="VD: 0912345678"
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
          ref={emailRef}
          disabled={isPending}
          // Compute the "did you mean" hint while TYPING, not on blur. An onBlur
          // toggle fires as the user mouses-down on "Tiếp tục", removing the hint
          // paragraph and reflowing the button out from under the cursor between
          // mousedown and mouseup — the click lands on nothing and submit silently
          // no-ops. onChange keeps the layout stable by the click moment.
          onChange={(e) => setEmailSuggestion(suggestEmail(e.target.value))}
          aria-describedby={fieldErrors.buyerEmail ? 'buyerEmail-error' : undefined}
        />
        {fieldErrors.buyerEmail && (
          <p id="buyerEmail-error" className="text-destructive text-sm mt-1">
            {fieldErrors.buyerEmail}
          </p>
        )}
        {activeSuggestion && (
          <p className="text-sm mt-1 text-warning-foreground">
            Có phải bạn muốn nhập{' '}
            <button
              type="button"
              onClick={acceptSuggestion}
              className="font-semibold underline underline-offset-2 text-primary-strong"
            >
              {activeSuggestion}
            </button>
            ?
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

      <Button type="submit" size="lg" disabled={isPending} className="w-full bg-primary-strong hover:bg-primary-strong/90">
        {isPending ? 'Đang xử lý...' : 'Tiếp tục'}
      </Button>
    </form>
  );
}
