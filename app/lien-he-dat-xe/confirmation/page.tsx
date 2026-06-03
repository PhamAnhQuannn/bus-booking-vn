/**
 * /lien-he-dat-xe/confirmation — charter request received confirmation (Issue 082).
 *
 * Shown after a successful POST /api/charter. Reads the ref from the query string
 * (?ref=CH-YYYY-XXXXXX) and shows the "đã nhận yêu cầu" message + the ref + a link
 * to the public status page. No DB read — the ref is the only state needed, and the
 * status page (ref-keyed) is the live source of truth. A honeypot drop redirects
 * here without a ref; we still render a generic received message in that case.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Đã nhận yêu cầu | BBVN',
  robots: { index: false },
};

interface ConfirmationPageProps {
  searchParams: Promise<{ ref?: string }>;
}

const REF_RE = /^CH-\d{4}-[0-9A-Z]{6}$/;

export default async function CharterConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const { ref: rawRef } = await searchParams;
  // Only trust a well-formed ref from the query string (display-only).
  const ref = rawRef && REF_RE.test(rawRef) ? rawRef : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-e2">
        <span className="flex size-14 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Đã nhận yêu cầu</h1>
          <p className="text-sm text-muted-foreground">
            Chúng tôi sẽ liên hệ với bạn sớm để tư vấn lịch trình và báo giá.
          </p>
        </div>

        {ref && (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Mã yêu cầu</span>
            <span className="font-mono text-2xl font-bold tracking-widest text-primary">{ref}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {ref && (
            <Link href={`/charter/status/${encodeURIComponent(ref)}`} className={buttonVariants({})}>
              Theo dõi trạng thái
            </Link>
          )}
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
