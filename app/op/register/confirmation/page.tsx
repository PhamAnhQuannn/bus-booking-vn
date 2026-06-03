/**
 * /op/register/confirmation — post-registration confirmation (Issue 076).
 *
 * Shows the application reference (from ?ref=) + next-steps copy. Server
 * component: searchParams is async in Next.js 16. Public + shell-exempt (listed
 * in proxy.ts OP_AUTH_FREE_PATHS, lives outside the (console) route group).
 *
 * The SLA copy is a RANGE ("within 2 business days"), never an exact countdown
 * (AC3) — it mirrors lib/onboarding/registerOperator.ts REGISTER_SLA_RANGE.
 */

import Link from 'next/link';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export default async function OpRegisterConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <AuthSplitLayout
      audience="operator"
      title="Đã nhận hồ sơ đăng ký"
      subtitle="Cảm ơn bạn. Hồ sơ của bạn đang được xem xét."
    >
      <Card className="shadow-e3">
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Hồ sơ của bạn đang được xem xét — chúng tôi sẽ gửi email cho bạn trong vòng 2 ngày làm
            việc.
          </p>
          {ref && (
            <div className="grid gap-1.5">
              <span className="text-sm text-muted-foreground">Mã hồ sơ</span>
              <code className="rounded-md bg-muted px-3 py-2 font-mono text-base font-semibold tracking-wide">
                {ref}
              </code>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Bạn có thể đăng nhập ngay để chuẩn bị đội xe và tuyến đường trong khi chờ duyệt.
          </p>
          <Link href="/op/login" className={buttonVariants({ className: 'w-full' })}>
            Đăng nhập
          </Link>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
