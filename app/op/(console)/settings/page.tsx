/**
 * /op/settings — Operator Settings hub (Issue 080 / S09). Server component.
 *
 * S09 Settings = profile (company name, contact phone) + payout bank account +
 * staff (role-scoped) + first-login forced password change. The dedicated pages
 * for profile/staff/first-login already exist (Issues 017/079/etc.) — this hub
 * LINKS to them and hosts the new payout bank-account section inline.
 *
 * Reads the masked payout account IN-PROCESS (getPayoutAccount — no self-fetch,
 * AGENTS.md 002/003). Render body is pure (no Date.now()/random — Issue 016).
 *
 * Staff link is admin-only (staff management is adminOnly per the existing nav).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserCircle, Users, ShieldCheck, KeyRound } from 'lucide-react';

import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getPayoutAccount } from '@/lib/onboarding';
import { prisma } from '@/lib/core/db/client';

import { PageHeader } from '@/components/op/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import BankAccountForm, { type MaskedAccount } from './BankAccountForm';

interface HubLink {
  label: string;
  href: string;
  description: string;
  icon: typeof UserCircle;
  adminOnly?: boolean;
}

const HUB_LINKS: HubLink[] = [
  {
    label: 'Hồ sơ',
    href: '/op/profile',
    description: 'Tên công ty, số liên hệ.',
    icon: UserCircle,
  },
  {
    label: 'Nhân viên',
    href: '/op/staff',
    description: 'Quản lý tài khoản nhân viên (theo vai trò).',
    icon: Users,
    adminOnly: true,
  },
  {
    label: 'Trạng thái đăng ký',
    href: '/op/status',
    description: 'Tình trạng duyệt hồ sơ + KYB.',
    icon: ShieldCheck,
  },
  {
    label: 'Đổi mật khẩu',
    href: '/op/first-login',
    description: 'Đổi mật khẩu đăng nhập.',
    icon: KeyRound,
  },
];

export default async function OpSettingsPage() {
  const session = await getOperatorSession();
  if (!session) redirect('/op/login');
  if (session.requiresPasswordChange) redirect('/op/first-login');

  const raw = await getPayoutAccount(prisma, session.operatorId);
  const account: MaskedAccount | null = raw
    ? {
        bankName: raw.bankName,
        accountNumberMasked: raw.accountNumberMasked,
        accountHolderName: raw.accountHolderName,
        verified: raw.verifiedAt != null,
      }
    : null;

  const links = HUB_LINKS.filter((l) => !l.adminOnly || session.role === 'admin');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <PageHeader title="Cài đặt" subtitle="Hồ sơ, tài khoản ngân hàng, nhân viên và bảo mật." />

      <div className="flex flex-col gap-6">
        {/* Hub links to existing settings pages */}
        <section aria-labelledby="hub-heading" className="grid gap-3 sm:grid-cols-2">
          <h2 id="hub-heading" className="sr-only">
            Trang cài đặt
          </h2>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
              data-testid={`settings-link-${l.href.split('/').pop()}`}
            >
              <l.icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-medium group-hover:underline">{l.label}</span>
                <span className="block text-sm text-muted-foreground">{l.description}</span>
              </span>
            </Link>
          ))}
        </section>

        {/* Payout bank account */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              Tài khoản ngân hàng nhận chi trả
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BankAccountForm account={account} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
