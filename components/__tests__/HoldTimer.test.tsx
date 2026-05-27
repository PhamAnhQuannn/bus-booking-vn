import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldTimer } from '../HoldTimer';
import { useHoldTimerStore } from '@/lib/state/holdTimerStore';

describe('HoldTimer', () => {
  beforeEach(() => {
    useHoldTimerStore.setState({ remainingMs: 0, isWarning: false, isExpired: true });
  });

  it('renders nothing when isExpired=true', () => {
    const { container } = render(<HoldTimer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders countdown when not expired', () => {
    useHoldTimerStore.setState({
      remainingMs: 5 * 60 * 1000, // 5 minutes
      isWarning: false,
      isExpired: false,
    });
    render(<HoldTimer />);
    const el = screen.getByTestId('hold-timer-countdown');
    expect(el.textContent).toBe('05:00');
  });

  it('applies warning class (text-red-600) when isWarning=true', () => {
    useHoldTimerStore.setState({
      remainingMs: 90 * 1000, // 1.5 minutes
      isWarning: true,
      isExpired: false,
    });
    render(<HoldTimer />);
    const countdown = screen.getByTestId('hold-timer-countdown');
    const wrapper = countdown.parentElement!;
    expect(wrapper.className).toContain('text-destructive');
  });

  it('does NOT apply warning class when isWarning=false', () => {
    useHoldTimerStore.setState({
      remainingMs: 8 * 60 * 1000,
      isWarning: false,
      isExpired: false,
    });
    render(<HoldTimer />);
    const countdown = screen.getByTestId('hold-timer-countdown');
    const wrapper = countdown.parentElement!;
    expect(wrapper.className).not.toContain('text-destructive');
    expect(wrapper.className).toContain('text-muted-foreground');
  });

  it('formats countdown correctly for sub-minute time', () => {
    useHoldTimerStore.setState({
      remainingMs: 45 * 1000, // 45 seconds
      isWarning: true,
      isExpired: false,
    });
    render(<HoldTimer />);
    const el = screen.getByTestId('hold-timer-countdown');
    expect(el.textContent).toBe('00:45');
  });
});
