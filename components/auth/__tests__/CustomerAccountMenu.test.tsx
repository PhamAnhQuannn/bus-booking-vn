import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { setDisplayName, clearSession } from '@/lib/auth/clientSession';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { CustomerAccountMenu } from '../CustomerAccountMenu';

describe('CustomerAccountMenu', () => {
  beforeEach(() => {
    document.cookie = 'bb_csrf=testcsrf';
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    clearSession();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders with initials derived from the display name', () => {
    setDisplayName('Nguyen Van A');
    render(<CustomerAccountMenu />);
    expect(screen.getByText('NV')).toBeDefined();
  });

  it('falls back to "KH" initials when no display name is set', () => {
    render(<CustomerAccountMenu />);
    expect(screen.getByText('KH')).toBeDefined();
  });

  it('opens the menu on trigger click', async () => {
    setDisplayName('Nguyen Van A');
    render(<CustomerAccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Nguyen Van A/ }));
    expect(await screen.findByText('Đăng xuất')).toBeDefined();
  });

  it('logout click POSTs /api/auth/logout with the CSRF header and redirects home', async () => {
    setDisplayName('Nguyen Van A');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<CustomerAccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Nguyen Van A/ }));
    const logoutItem = await screen.findByText('Đăng xuất');
    fireEvent.click(logoutItem);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: { 'X-CSRF-Token': 'testcsrf' },
          credentials: 'same-origin',
        }),
      );
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });
});
