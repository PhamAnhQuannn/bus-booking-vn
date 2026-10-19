/**
 * English-locale render of CustomerAccountMenu. The global vitest.setup.ts mock pins
 * next-intl to the vi catalog; this file overrides it with the real en `common` catalog so
 * the menu's strings are asserted in English too.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { setDisplayName, clearSession } from '@/lib/auth/clientSession';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next-intl', async (importActual) => {
  const actual = await importActual<typeof import('next-intl')>();
  const common = (await import('@/messages/en/common.json')).default;
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({ locale: 'en', messages: { common } as never, namespace: namespace as never }),
    useLocale: () => 'en',
  };
});

import { CustomerAccountMenu } from '../CustomerAccountMenu';

describe('CustomerAccountMenu (en)', () => {
  afterEach(() => {
    cleanup();
    clearSession();
  });

  it('renders English trigger aria-label and menu items', async () => {
    setDisplayName('Jane Doe');
    render(<CustomerAccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Account: Jane Doe' }));
    expect(await screen.findByText('Booking history')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('Log out')).toBeDefined();
  });

  it('falls back to the English customer label when no display name is set', () => {
    render(<CustomerAccountMenu />);
    expect(screen.getByRole('button', { name: 'Account: Customer' })).toBeDefined();
  });
});
