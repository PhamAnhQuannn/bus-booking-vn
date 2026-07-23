'use client';

/**
 * NewsletterBand — full-bleed orange email-capture band (docs/design/mockup-home.png S9).
 * Envelope icon + two lines of copy on the left; a single rounded pill on the right
 * holding the email input with an embedded white "Đăng ký" button.
 *
 * ⚠ NON-FUNCTIONAL BY DESIGN — there is no newsletter backend, no list, and no endpoint.
 * The form deliberately has no action and no submit handler so it cannot post anywhere or
 * imply an address was stored. It exists to match the mockup; wire it up or remove it
 * before this ships.
 *
 * ⚠ KNOWN CONTRAST FAILURE — white body copy on the mockup's orange field is below WCAG
 * AA, and the project's own design research (rule C1) says orange is never a full field.
 * Reproduced here because the mockup was adopted verbatim; see
 * docs/design/mockup-home-spec.md §1 for the argument against keeping it.
 */

import { Mail } from 'lucide-react';

export function NewsletterBand() {
  return (
    <section
      aria-label="Đăng ký nhận ưu đãi"
      className="w-full bg-[#f26b1c] text-primary-foreground"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-5 px-4 py-8 lg:flex-row lg:justify-between lg:gap-8 lg:py-6">
        <div className="flex items-center gap-4">
          <Mail className="size-8 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-bold leading-tight sm:text-lg">
              Nhận ưu đãi và thông tin mới nhất từ BBVN
            </p>
            <p className="text-sm text-primary-foreground/90">
              Đăng ký email để không bỏ lỡ chương trình khuyến mãi hấp dẫn
            </p>
          </div>
        </div>

        {/* No action / no onSubmit — see the non-functional note above. */}
        <form
          className="flex w-full max-w-md items-center gap-0 rounded-full bg-card p-1 shadow-e1 lg:w-auto lg:min-w-[340px]"
          onSubmit={(e) => e.preventDefault()}
        >
          <label htmlFor="newsletter-email" className="sr-only">
            Email của bạn
          </label>
          <input
            id="newsletter-email"
            type="email"
            autoComplete="email"
            placeholder="Nhập email của bạn"
            className="min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center rounded-full px-5 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Đăng ký
          </button>
        </form>
      </div>
    </section>
  );
}
