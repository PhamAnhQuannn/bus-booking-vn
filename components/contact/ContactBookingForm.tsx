'use client';

/**
 * ContactBookingForm — tourism / charter ("thuê xe hợp đồng") booking inquiry.
 * Gathers customer contact + trip details. NOTE: submission is a client-side
 * placeholder (shows a success state) — there is no backend/notification wired
 * yet. TODO: POST to an inquiry API (validate + store/notify) when available.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Send } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';

export function ContactBookingForm() {
  const [submitted, setSubmitted] = useState(false);
  // Earliest selectable departure = today (Asia/Ho_Chi_Minh); computed once for SSR stability.
  const [todayVN] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Placeholder: no backend yet. Show the success state.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-e2">
        <span className="flex size-14 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Đã nhận yêu cầu!</h2>
          <p className="text-sm text-muted-foreground">
            Cảm ơn bạn. Tổng đài BBVN sẽ liên hệ lại trong vòng 15 phút để tư vấn và báo giá.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => setSubmitted(false)}>
            Gửi yêu cầu khác
          </Button>
          <Link href="/" className={buttonVariants({})}>
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-label="Liên hệ đặt xe">
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
          <Label htmlFor="email">Email (tuỳ chọn)</Label>
          <Input id="email" name="email" type="email" placeholder="ban@email.com" autoComplete="email" />
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

      <Button type="submit" size="lg" className="w-full gap-2 sm:w-auto sm:self-start">
        <Send className="size-4" aria-hidden="true" />
        Gửi yêu cầu
      </Button>
    </form>
  );
}
