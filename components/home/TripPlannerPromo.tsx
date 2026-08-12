/**
 * TripPlannerPromo — "Trợ lý du lịch AI" landing section (mockup S4). Full-width band
 * that softly fades white→cream→white (px stops) at top+bottom, emerging from the page
 * with no hard border. LEFT = eyebrow + heading + subcopy +
 * 4-step row + CTA; RIGHT = a LABELLED example-chat mock with an inert preview input.
 * Chat is illustrative only ("*Ví dụ") — it does not call the planner. CTA → /tro-ly-du-lich.
 */

import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  BusFront,
  CalendarDays,
  Compass,
  Luggage,
  MapPin,
  Send,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const STEPS = [
  { icon: MapPin, title: 'Chọn điểm đến', sub: 'Bạn muốn đi đâu?' },
  { icon: CalendarDays, title: 'Tạo lịch trình', sub: 'Chi tiết từng ngày' },
  { icon: BusFront, title: 'Tìm phương tiện', sub: 'Chuyến xe phù hợp' },
  { icon: Luggage, title: 'Gợi ý trải nghiệm', sub: 'Điểm tham quan, món ăn' },
];

const ITINERARY = [
  { day: 'Ngày 1', text: 'Hồ Xuân Hương – Dinh Bảo Đại – Quảng trường Lâm Viên' },
  { day: 'Ngày 2', text: 'Langbiang – Thác Datanla – Fresh Garden' },
  { day: 'Ngày 3', text: 'Đồi chè Cầu Đất – Chợ Đà Lạt – Trở về' },
];

export function TripPlannerPromo() {
  return (
    <section className="w-full bg-[linear-gradient(to_bottom,#FFFCFA_0px,#FFF6EE_40px,#FFF3E9_80px,#FFF3E9_calc(100%_-_80px),#FFF6EE_calc(100%_-_40px),#FFFCFA_100%)] py-6 lg:py-8">
      <div className="page-container grid grid-cols-1 items-center gap-8 lg:grid-cols-[45fr_55fr]">
        {/* LEFT — eyebrow + heading + subcopy + 4-step row + CTA */}
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary backdrop-blur">
            <Sparkles className="size-4" aria-hidden="true" />
            Trợ lý du lịch
            <span className="rounded bg-primary-strong px-1 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-primary-foreground">
              AI
            </span>
          </span>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            <span className="block">Lên kế hoạch chuyến đi</span>
            <span className="block">
              thông minh cùng <span className="text-primary">AI</span>
            </span>
          </h2>

          <p className="max-w-md text-[15px] text-foreground/80">
            Chỉ cần chọn điểm đến, số ngày và sở thích. Trợ lý du lịch sẽ tạo lịch trình và gợi ý
            phương tiện phù hợp.
          </p>

          {/* 4-step row — inside the left column, below the pitch and above the CTA */}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex flex-col items-start gap-2">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-strong">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold leading-tight text-foreground">{title}</span>
                <span className="text-xs leading-snug text-muted-foreground">{sub}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/tro-ly-du-lich"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'mt-1 w-fit gap-2 rounded-lg bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 [a]:hover:bg-primary-strong/90'
            )}
          >
            Bắt đầu lập kế hoạch
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {/* RIGHT — labelled example-chat mock (illustrative, not interactive) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-e2">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3 text-xs font-medium text-muted-foreground">
            <Compass className="size-4 text-primary" aria-hidden="true" />
            Ví dụ từ Trợ lý du lịch AI
          </div>

          <p className="max-w-[80%] self-end rounded-2xl rounded-br-sm bg-primary/10 px-3 py-2 text-sm text-foreground">
            Mình muốn đi Đà Lạt 3 ngày 2 đêm, ngân sách ~3 triệu/người
          </p>

          <div className="flex gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
              <Bot className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-2">
              <p className="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2 text-sm text-foreground">
                Tuyệt vời! Đây là lịch trình gợi ý cho bạn:
              </p>
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary-strong">
                  Đà Lạt · 3 ngày 2 đêm
                </p>
                <ul className="flex flex-col gap-1.5">
                  {ITINERARY.map(({ day, text }) => (
                    <li key={day} className="flex gap-2 text-xs">
                      <span className="shrink-0 font-semibold text-foreground">{day}</span>
                      <span className="text-muted-foreground">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Inert preview input — presentational only (aria-hidden, no real field). */}
          <div
            aria-hidden="true"
            className="mt-1 flex items-center gap-2 rounded-full border border-border bg-secondary/40 py-1.5 pl-4 pr-1.5"
          >
            <span className="flex-1 truncate text-sm text-muted-foreground">
              Bạn muốn hỏi thêm điều gì?
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-strong text-primary-foreground">
              <Send className="size-4" aria-hidden="true" />
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            *Ví dụ lịch trình được tạo bởi Trợ lý du lịch
          </p>
        </div>
      </div>
    </section>
  );
}
