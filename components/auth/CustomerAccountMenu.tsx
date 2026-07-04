'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { ChevronDownIcon, LogOutIcon, TicketIcon, SettingsIcon } from 'lucide-react';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { clearSession, useDisplayName } from '@/lib/auth/clientSession';
import { cn } from '@/lib/utils';

export function CustomerAccountMenu() {
  const router = useRouter();
  const displayName = useDisplayName();
  const [pending, setPending] = React.useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCsrfToken() },
        credentials: 'same-origin',
      });
    } catch {
      // best-effort
    }
    clearSession();
    router.push('/');
    router.refresh();
  }

  const name = displayName ?? 'Khách hàng';
  const initials = displayName
    ? displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0))
        .join('')
        .toUpperCase()
    : 'KH';

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted'
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end">
          <Menu.Popup
            className={cn(
              'z-50 min-w-44 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-e3 outline-none',
              'transition-[transform,opacity] duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0'
            )}
          >
            <div className="px-2 py-1.5 text-xs text-muted-foreground sm:hidden">{name}</div>
            <Menu.Item
              render={
                <Link
                  href="/account/bookings"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                />
              }
            >
              <TicketIcon aria-hidden="true" className="size-4" /> Lịch sử đặt vé
            </Menu.Item>
            <Menu.Item
              render={
                <Link
                  href="/account/settings"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                />
              }
            >
              <SettingsIcon aria-hidden="true" className="size-4" /> Cài đặt
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={handleLogout}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 data-[highlighted]:bg-destructive/10 disabled:opacity-50"
            >
              <LogOutIcon aria-hidden="true" className="size-4" />
              {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
