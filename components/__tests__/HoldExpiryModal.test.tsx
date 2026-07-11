import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useHoldTimerStore, useBookingStore } from '@/lib/state';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

import { HoldExpiryModal } from '../HoldExpiryModal';

describe('HoldExpiryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHoldTimerStore.setState({ remainingMs: 5 * 60 * 1000, isWarning: false, isExpired: false });
  });

  it('renders nothing when isExpired=false', () => {
    const { container } = render(<HoldExpiryModal />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with expiry message when isExpired=true', () => {
    useHoldTimerStore.setState({ remainingMs: 0, isWarning: false, isExpired: true });
    render(<HoldExpiryModal />);
    expect(screen.getByText('Chỗ giữ đã hết hạn')).toBeDefined();
  });

  it('calls clearBooking() when isExpired=true', () => {
    const clearSpy = vi.fn();
    useBookingStore.setState({ clearBooking: clearSpy });
    useHoldTimerStore.setState({ remainingMs: 0, isWarning: false, isExpired: true });
    render(<HoldExpiryModal />);
    expect(clearSpy).toHaveBeenCalled();
  });

  it('navigates to homepage on button click', () => {
    useHoldTimerStore.setState({ remainingMs: 0, isWarning: false, isExpired: true });
    render(<HoldExpiryModal />);
    fireEvent.click(screen.getByText('Tìm chuyến xe mới'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
