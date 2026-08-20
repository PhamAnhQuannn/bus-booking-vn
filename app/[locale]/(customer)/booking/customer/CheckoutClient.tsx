'use client';

/**
 * CheckoutClient — merged customer-info + consent + auto payment step.
 *
 * Flow (no explicit "confirm" button):
 *   1. Fill passenger info (name/phone/email + pickup). Consent + payment stay
 *      disabled/greyed until the info is valid.
 *   2. Tick BOTH consents → the page AUTOMATICALLY runs createHold → initiate
 *      (booking created only AFTER consent — the Issue 089 legal gate) → reveals
 *      the real VietQR transfer details + BankTransferClient (countdown +
 *      auto-redirect on paid).
 *
 * Why booking-before-QR: a scannable QR must be backed by an existing Booking
 * row. If a customer paid before the booking existed, the transfer would land as
 * an orphan PaymentEvent that reconcile deliberately never auto-credits (single
 * shared receiving account). So the QR only appears after the booking is created.
 * On reveal we swap the URL to ?bookingRef (history.replaceState) so a refresh
 * re-hydrates via the server page's payment-mode branch.
 *
 * Bank transfer (VietQR) is the only method — VNPay is removed (no live callback
 * route in production).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { createHoldRequest } from '@/lib/api';
import { customerFormSchema } from '@/lib/booking/customerFormSchema';
import { suggestEmail } from '@/lib/booking/emailSuggest';
import { validatePickupSelection } from '@/lib/booking/pickupSelection';
import { CONSENT_TEXT, CONSENT_VERSION } from '@/lib/booking/consent';
import { authFetch, getDisplayName } from '@/lib/auth/clientSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TripInfoCard } from '@/components/booking/TripInfoCard';
import { BankTransferDetails } from '@/components/booking/BankTransferDetails';
import { BankTransferClient } from '../bank-transfer/BankTransferClient';
import { cn } from '@/lib/utils';

const PHONE_STORAGE_KEY = 'busbooking_last_phone';

// Hold-creation error copy (lifted from the former CustomerForm alert blocks).
// Display strings resolve from the `booking.hold.*` / `booking.error.*` catalog at
// render (localized VI/EN); see errorLabel()/holdAlertText() inside the component.
type HoldAlert =
  | { kind: 'sold_out' }
  | { kind: 'rate_limited'; retryAfter: number }
  | { kind: 'hold_cap' }
  | { kind: 'seat_map_busy' }
  | { kind: 'request_in_flight' }
  | { kind: 'error'; message: string };

interface RevealedPayment {
  bookingRef: string;
  amount: number;
  redirectUrl?: string;
  confirmationToken: string;
  qrUrl: string;
  deadlineIso: string;
}

export interface CheckoutClientProps {
  tripId: string;
  ticketCount: number;
  boardingPoint: string | null;
  boardingTime: string | null;
  /** Read-only trip facts for the "Thông tin chuyến đi" card (server-resolved). */
  trip: {
    routeOrigin: string;
    routeDestination: string;
    departureAt: string; // ISO
    operatorLegalName: string;
    vehicleLabel: string;
  };
  pspWindowMinutes: number;
  vietqr: {
    bankBin: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    template: string;
  };
}

export function CheckoutClient({
  tripId,
  ticketCount,
  boardingPoint,
  boardingTime,
  trip,
  pspWindowMinutes,
  vietqr,
}: CheckoutClientProps) {
  const router = useRouter();
  const t = useTranslations('booking');

  // Initiate error-code → localized copy. Unknown codes fall back to UNAVAILABLE.
  const errorLabel = (code: string): string =>
    t.has(`error.${code}`) ? t(`error.${code}`) : t('error.UNAVAILABLE');
  // Hold-creation alert → localized copy (rate_limited carries a {seconds} param; the
  // 'error' kind carries a pre-resolved message).
  const holdAlertText = (a: HoldAlert): string => {
    if (a.kind === 'rate_limited') return t('hold.rate_limited', { seconds: a.retryAfter });
    if (a.kind === 'error') return a.message;
    return t(`hold.${a.kind}`);
  };

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [pickupKind, setPickupKind] = useState<'station' | 'custom'>('station');
  const [pickupDetail, setPickupDetail] = useState('');
  const customDetailRef = useRef<HTMLInputElement>(null);

  const [noRefund, setNoRefund] = useState(false);
  const [piiStorage, setPiiStorage] = useState(false);
  const consented = noRefund && piiStorage;

  const [submitting, setSubmitting] = useState(false);
  const [holdAlert, setHoldAlert] = useState<HoldAlert | null>(null);
  const [initiateError, setInitiateError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedPayment | null>(null);
  // #526: the boarding point the SERVER actually stored on the hold (null once a stale/
  // mismatched selection is dropped). Null until the hold succeeds; then it authoritatively
  // replaces the results-card selection in the display.
  const [resolvedBoarding, setResolvedBoarding] = useState<{ point: string | null; time: string | null } | null>(null);
  // Guards the auto-fire so createHold/initiate run exactly once (retry is manual).
  const firedRef = useRef(false);
  // #586: the override args that last got us PAST the typo gate. retry() replays them so a
  // transient hold error after an override/correction doesn't re-enter the gate on the
  // original typo'd email (which silently re-blocks and looks like retry did nothing).
  const lastFireArgs = useRef<{ email?: string; skipTypoGate?: boolean } | undefined>(undefined);

  // Prefill phone (sessionStorage) + name (signed-in display name). Browser-only
  // sources, so this must run in a mount effect, not a lazy useState initializer
  // (both would throw during SSR) — same documented pattern as the booking layout.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(PHONE_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only prefill, same pattern as booking layout
      if (saved) setBuyerPhone(saved);
    }
    const name = getDisplayName();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only prefill, same pattern as booking layout
    if (name) setBuyerName((v) => v || name);
  }, []);

  // Reactive validity — per-field issues + whole-form completeness. Field errors
  // only show once a field is non-empty (no "required" nag on untouched fields).
  const parsed = customerFormSchema.safeParse({ buyerName, buyerPhone, buyerEmail });
  const issues: Record<string, string> = {};
  if (!parsed.success) {
    for (const iss of parsed.error.issues) {
      const key = String(iss.path[0]);
      if (key && !issues[key]) issues[key] = iss.message;
    }
  }
  const pickupOk = validatePickupSelection({ kind: pickupKind, detail: pickupDetail }).ok;
  const infoComplete = parsed.success && pickupOk;

  const emailSuggestion = useMemo(
    () => (buyerEmail.trim() ? suggestEmail(buyerEmail) : null),
    [buyerEmail],
  );

  const locked = submitting || revealed !== null;

  // #526: display the SERVER-resolved boarding point once the hold succeeds (it authoritatively
  // replaces the results-card selection). `boardingDropped` = a point WAS chosen but the server
  // dropped it as stale — the traveler is warned instead of shown a pickup that isn't on the ticket.
  const displayBoardingPoint = resolvedBoarding ? resolvedBoarding.point : boardingPoint;
  const displayBoardingTime = resolvedBoarding ? resolvedBoarding.time : boardingTime;
  const boardingDropped = !!boardingPoint && resolvedBoarding !== null && resolvedBoarding.point === null;

  async function fire(override?: { email?: string; skipTypoGate?: boolean }) {
    const effectiveEmail = override?.email ?? buyerEmail;
    const p = customerFormSchema.safeParse({ buyerName, buyerPhone, buyerEmail: effectiveEmail });
    const pickupCheck = validatePickupSelection({ kind: pickupKind, detail: pickupDetail });
    if (!p.success || !pickupCheck.ok) return;

    // #525: email-typo soft-gate. Block the first (auto-)submit on a likely domain typo
    // (e.g. gmial.com → gmail.com) so a mistyped address doesn't silently complete a
    // hold + bank-transfer booking whose ticket/receipt then bounces. The buyer proceeds
    // by accepting the suggestion or explicitly overriding (both pass skipTypoGate).
    if (!override?.skipTypoGate && suggestEmail(effectiveEmail) !== null) {
      firedRef.current = false; // re-arm so a later decision can fire again
      setSubmitting(false);
      return;
    }

    // #586: past the gate — remember what got us here so retry() re-fires identically.
    // #602: pin the concrete resolved email, so an override grant can't leak onto a
    // different address the buyer edits to afterwards (see the onChange invalidation).
    lastFireArgs.current = { ...override, email: effectiveEmail };

    setHoldAlert(null);
    setInitiateError(null);
    setSubmitting(true);

    // ---- 1. Create the hold -------------------------------------------------
    const hold = await createHoldRequest({
      tripId,
      ticketCount,
      buyerName: p.data.buyerName,
      buyerPhone: p.data.buyerPhone,
      buyerEmail: p.data.buyerEmail,
      pickupKind: pickupCheck.pickupKind,
      pickupDetail: pickupCheck.pickupKind === 'custom' ? pickupCheck.pickupDetail : undefined,
      boardingPoint: boardingPoint ?? undefined,
      boardingTime: boardingTime ?? undefined,
    });

    if (!hold.ok) {
      setSubmitting(false);
      switch (hold.code) {
        case 'SOLD_OUT':
          router.refresh();
          return setHoldAlert({ kind: 'sold_out' });
        case 'TOO_MANY_REQUESTS':
          return setHoldAlert({ kind: 'rate_limited', retryAfter: hold.retryAfter ?? 60 });
        case 'SESSION_SEAT_CAP_EXCEEDED':
        case 'HOLD_CAP_EXCEEDED':
          return setHoldAlert({ kind: 'hold_cap' });
        case 'SEAT_MAP_BUSY':
          return setHoldAlert({ kind: 'seat_map_busy' });
        case 'REQUEST_IN_FLIGHT':
          return setHoldAlert({ kind: 'request_in_flight' });
        default:
          return setHoldAlert({ kind: 'error', message: t('error.generic') });
      }
    }

    // #526: reflect the SERVER-resolved boarding point (null if the chosen one was dropped as
    // stale/mismatched) so the confirmation/QR screen never shows a pickup that was never
    // recorded on the ticket. Before submit the display uses the results-card selection; after
    // a successful hold it switches to what the server actually stored.
    setResolvedBoarding({ point: hold.boardingPoint, time: hold.boardingTime });

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PHONE_STORAGE_KEY, p.data.buyerPhone);
    }

    // ---- 2. Initiate the booking (bank_transfer only) ----------------------
    try {
      const res = await authFetch('/api/bookings/initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          holdId: hold.holdId,
          paymentMethod: 'bank_transfer',
          consents: { noRefund, piiStorage, version: CONSENT_VERSION },
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.payUrl) {
        const url = new URL(data.payUrl as string, window.location.origin);
        if (url.pathname === '/booking/bank-transfer') {
          const bookingRef = url.searchParams.get('bookingRef') ?? '';
          const amount = Number(url.searchParams.get('amount'));
          const redirectUrl = url.searchParams.get('redirectUrl') ?? undefined;
          const confirmationToken = redirectUrl ? (redirectUrl.split('/').pop() ?? '') : '';
          const qrUrl = `https://img.vietqr.io/image/${vietqr.bankBin}-${vietqr.accountNumber}-${vietqr.template}.png?amount=${amount}&addInfo=${encodeURIComponent(bookingRef)}`;
          const deadlineIso = new Date(Date.now() + pspWindowMinutes * 60_000).toISOString();
          setRevealed({ bookingRef, amount, redirectUrl, confirmationToken, qrUrl, deadlineIso });
          setSubmitting(false);
          // Refresh-durable: swap the URL to ?bookingRef WITHOUT a server rerender so
          // the inline reveal stays; a manual refresh then re-hydrates via the server
          // page's payment-mode branch (getBookingByRef).
          const durable = new URLSearchParams({ bookingRef, amount: String(amount) });
          if (redirectUrl) durable.set('redirectUrl', redirectUrl);
          window.history.replaceState(null, '', `/booking/customer?${durable.toString()}`);
          return;
        }
        // Idempotent /booking/result return → full navigation.
        window.location.href = data.payUrl as string;
        return;
      }

      const code = typeof data?.error === 'string' ? data.error : 'UNAVAILABLE';
      setInitiateError(errorLabel(code));
      setSubmitting(false);
    } catch {
      setInitiateError(t('error.UNAVAILABLE'));
      setSubmitting(false);
    }
  }

  // Auto-fire once info is valid AND both consents are accepted. Triggered from
  // the consent toggles (consents are disabled until infoComplete, so info is
  // always valid at this point). firedRef guards against a double-fire.
  function maybeAutoFire(nextNoRefund: boolean, nextPii: boolean) {
    if (infoComplete && nextNoRefund && nextPii && !firedRef.current) {
      firedRef.current = true;
      void fire();
    }
  }

  function retry() {
    setHoldAlert(null);
    setInitiateError(null);
    void fire(lastFireArgs.current);
  }

  const hasError = holdAlert !== null || initiateError !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Passenger info */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('checkout.passengerInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="buyerName" className="mb-1">
                  {t('checkout.fullName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="buyerName"
                  name="buyerName"
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  disabled={locked}
                  placeholder={t('checkout.fullNamePlaceholder')}
                  aria-describedby={buyerName.trim() && issues.buyerName ? 'buyerName-error' : undefined}
                />
                {buyerName.trim() && issues.buyerName && (
                  <p id="buyerName-error" className="mt-1 text-sm text-destructive">
                    {issues.buyerName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="buyerPhone" className="mb-1">
                  {t('checkout.phone')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="buyerPhone"
                  name="buyerPhone"
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  disabled={locked}
                  placeholder={t('checkout.phonePlaceholder')}
                  aria-describedby={buyerPhone.trim() && issues.buyerPhone ? 'buyerPhone-error' : undefined}
                />
                {buyerPhone.trim() && issues.buyerPhone && (
                  <p id="buyerPhone-error" className="mt-1 text-sm text-destructive">
                    {issues.buyerPhone}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="buyerEmail" className="mb-1">
                {t('checkout.email')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="buyerEmail"
                name="buyerEmail"
                type="email"
                value={buyerEmail}
                onChange={(e) => {
                  const next = e.target.value;
                  setBuyerEmail(next);
                  // #602: a skipTypoGate grant is pinned to the email it was earned for.
                  // Editing away from that address drops the grant so retry() re-runs the
                  // gate on the new (possibly-typo) email instead of bypassing it blindly.
                  if (lastFireArgs.current?.skipTypoGate && lastFireArgs.current.email !== next) {
                    lastFireArgs.current = undefined;
                  }
                  // #586: if a typo gate-block stranded the buyer and they fix the address by
                  // editing the field directly (not via the suggestion chip), resume the
                  // auto-flow — consents are already in and nothing else re-fires. Guard on a
                  // complete, typo-free form and no fire in flight so we never fire on partial
                  // input or double-fire (validate `next` explicitly; buyerEmail state lags here).
                  const nextInfoOk =
                    customerFormSchema.safeParse({ buyerName, buyerPhone, buyerEmail: next }).success &&
                    pickupOk;
                  if (consented && !firedRef.current && !locked && nextInfoOk && suggestEmail(next) === null) {
                    firedRef.current = true;
                    void fire({ email: next });
                  }
                }}
                disabled={locked}
                placeholder={t('checkout.emailPlaceholder')}
                aria-describedby={buyerEmail.trim() && issues.buyerEmail ? 'buyerEmail-error' : undefined}
              />
              {buyerEmail.trim() && issues.buyerEmail && (
                <p id="buyerEmail-error" className="mt-1 text-sm text-destructive">
                  {issues.buyerEmail}
                </p>
              )}
              {emailSuggestion && !locked && (
                <p className="mt-1 text-sm text-warning-foreground">
                  {t('checkout.emailSuggestPrefix')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setBuyerEmail(emailSuggestion);
                      // Consents already accepted → correcting the typo resumes the
                      // auto-flow immediately (skip the gate: the suggestion has none).
                      if (consented) {
                        if (firedRef.current) return; // #586: guard against a rapid double-click
                        firedRef.current = true;
                        void fire({ email: emailSuggestion, skipTypoGate: true });
                      }
                    }}
                    className="font-semibold text-primary-strong underline underline-offset-2"
                  >
                    {emailSuggestion}
                  </button>
                  ?
                  {consented && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => {
                          // #525: explicit override — keep the typed email despite the hint.
                          if (firedRef.current) return; // #586: guard against a rapid double-click
                          firedRef.current = true;
                          void fire({ skipTypoGate: true });
                        }}
                        className="font-semibold underline underline-offset-2"
                      >
                        {t('checkout.emailKeep')}
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>

            {boardingPoint ? (
              boardingDropped ? (
                // #526: the chosen point was dropped server-side (schedule edited between the
                // results card and submit) — warn instead of showing a pickup that was never
                // recorded on the ticket.
                <div className="rounded-lg border border-warning-foreground/30 bg-warning-foreground/5 p-3">
                  <p className="text-sm font-medium text-warning-foreground">{t('checkout.boardingChanged')}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t('checkout.boardingChangedDesc')}
                  </p>
                </div>
              ) : (
                // Boarding point chosen on the results card IS the pickup — read-only. After the
                // hold, this shows the SERVER-resolved value (#526).
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-sm font-medium text-muted-foreground">{t('checkout.pickup')}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {displayBoardingPoint}
                    {displayBoardingTime ? ` · ${displayBoardingTime}` : ''}
                  </p>
                </div>
              )
            ) : (
              <fieldset className="flex flex-col gap-2" disabled={locked}>
                <legend className="mb-1 text-sm font-medium">{t('checkout.pickup')}</legend>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
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
                    <span className="text-sm">{t('checkout.pickupStation')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
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
                    <span className="text-sm">{t('checkout.pickupCustom')}</span>
                  </label>
                </div>
                {pickupKind === 'custom' && (
                  <div className="pt-1">
                    <Label htmlFor="pickupDetail" className="mb-1">
                      {t('checkout.pickupAddress')}
                    </Label>
                    <Input
                      ref={customDetailRef}
                      id="pickupDetail"
                      type="text"
                      value={pickupDetail}
                      onChange={(e) => setPickupDetail(e.target.value)}
                      placeholder={t('checkout.pickupAddressPlaceholder')}
                      data-testid="pickup-custom-detail"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('checkout.pickupAddressHint')}
                    </p>
                  </div>
                )}
              </fieldset>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Consent — right below the info (gated on infoComplete) */}
      <Card className={cn(!infoComplete && 'opacity-60')} aria-disabled={!infoComplete}>
        <CardHeader>
          <CardTitle as="h2">{t('checkout.terms')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!infoComplete && (
            <p className="mb-3 text-sm text-muted-foreground">
              {t('checkout.termsIncomplete')}
            </p>
          )}
          <fieldset className="flex flex-col gap-3" disabled={!infoComplete || locked}>
            <legend className="sr-only">{t('checkout.termsLegend')}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="consent-no-refund"
                checked={noRefund}
                onChange={(e) => {
                  setNoRefund(e.target.checked);
                  maybeAutoFire(e.target.checked, piiStorage);
                }}
                disabled={!infoComplete || locked}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                {CONSENT_TEXT.noRefund}{' '}
                <a href="/chinh-sach-huy-ve-hoan-tien" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {t('checkout.viewDetails')}
                </a>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="consent-pii-storage"
                checked={piiStorage}
                onChange={(e) => {
                  setPiiStorage(e.target.checked);
                  maybeAutoFire(noRefund, e.target.checked);
                }}
                disabled={!infoComplete || locked}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                {CONSENT_TEXT.piiStorage}{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {t('checkout.viewDetails')}
                </a>
              </span>
            </label>
          </fieldset>
        </CardContent>
      </Card>

      {/* 3. Trip info (read-only) */}
      <TripInfoCard
        routeOrigin={trip.routeOrigin}
        routeDestination={trip.routeDestination}
        departureAt={trip.departureAt}
        operatorLegalName={trip.operatorLegalName}
        vehicleLabel={trip.vehicleLabel}
        ticketCount={ticketCount}
        boardingPoint={displayBoardingPoint}
        boardingTime={displayBoardingTime}
      />

      {/* 4. Payment — VietQR only; QR reveals automatically after consent */}
      <Card className={cn(!infoComplete && 'opacity-60')} aria-disabled={!infoComplete}>
        <CardHeader>
          <CardTitle as="h2">{t('checkout.paymentMethod')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm font-medium">
            {t('checkout.bankTransfer')}
          </div>

          {revealed ? (
            <div className="mt-4 flex flex-col gap-4">
              <BankTransferDetails
                bankName={vietqr.bankName}
                accountNumber={vietqr.accountNumber}
                accountName={vietqr.accountName}
                bookingRef={revealed.bookingRef}
                amount={revealed.amount}
                qrUrl={revealed.qrUrl}
              />
              <BankTransferClient
                bookingRef={revealed.bookingRef}
                confirmationToken={revealed.confirmationToken}
                redirectUrl={revealed.redirectUrl}
                deadlineIso={revealed.deadlineIso}
                windowMinutes={pspWindowMinutes}
              />
            </div>
          ) : hasError ? (
            <div className="mt-4 flex flex-col gap-3">
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {initiateError ?? (holdAlert && holdAlertText(holdAlert))}
              </div>
              <Button
                type="button"
                onClick={retry}
                disabled={submitting}
                className="w-full bg-primary-strong hover:bg-primary-strong/90"
              >
                {submitting ? t('checkout.processing') : t('checkout.retry')}
              </Button>
            </div>
          ) : submitting ? (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 motion-safe:animate-spin" />
              {t('checkout.creatingQr')}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              {infoComplete
                ? t('checkout.consentToShowQr')
                : t('checkout.fillToShowQr')}
            </p>
          )}

          {revealed && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {t('checkout.ticketSent')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
