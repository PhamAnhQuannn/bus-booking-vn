import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHoldTimerStore } from '../holdTimerStore';

describe('holdTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store
    useHoldTimerStore.getState().stopTimer();
    useHoldTimerStore.setState({ remainingMs: 0, isWarning: false, isExpired: true });
  });

  afterEach(() => {
    useHoldTimerStore.getState().stopTimer();
    vi.useRealTimers();
  });

  it('starts with isExpired=true by default', () => {
    expect(useHoldTimerStore.getState().isExpired).toBe(true);
  });

  it('startTimer with future expiresAt sets remainingMs > 0 and isExpired=false', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min from now
    useHoldTimerStore.getState().startTimer(future);
    const state = useHoldTimerStore.getState();
    expect(state.remainingMs).toBeGreaterThan(0);
    expect(state.isExpired).toBe(false);
  });

  it('startTimer with past expiresAt sets isExpired=true and remainingMs=0', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    useHoldTimerStore.getState().startTimer(past);
    const state = useHoldTimerStore.getState();
    expect(state.remainingMs).toBe(0);
    expect(state.isExpired).toBe(true);
  });

  it('isWarning=true when remainingMs <= 2 minutes', () => {
    const almostTwoMin = new Date(Date.now() + 1.5 * 60 * 1000).toISOString();
    useHoldTimerStore.getState().startTimer(almostTwoMin);
    expect(useHoldTimerStore.getState().isWarning).toBe(true);
  });

  it('isWarning=false when remainingMs > 2 minutes', () => {
    const fiveMin = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    useHoldTimerStore.getState().startTimer(fiveMin);
    expect(useHoldTimerStore.getState().isWarning).toBe(false);
  });

  it('ticks down every second', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const threeSeconds = new Date(now + 3000).toISOString();
    useHoldTimerStore.getState().startTimer(threeSeconds);

    const initial = useHoldTimerStore.getState().remainingMs;
    vi.setSystemTime(now + 1000);
    vi.advanceTimersByTime(1000);
    const after1s = useHoldTimerStore.getState().remainingMs;
    expect(after1s).toBeLessThan(initial);
  });

  it('sets isExpired=true when countdown reaches 0', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const twoSeconds = new Date(now + 2000).toISOString();
    useHoldTimerStore.getState().startTimer(twoSeconds);

    vi.setSystemTime(now + 3000);
    vi.advanceTimersByTime(3000);
    expect(useHoldTimerStore.getState().isExpired).toBe(true);
    expect(useHoldTimerStore.getState().remainingMs).toBe(0);
  });

  it('stopTimer prevents further ticks', () => {
    const tenSeconds = new Date(Date.now() + 10000).toISOString();
    useHoldTimerStore.getState().startTimer(tenSeconds);
    useHoldTimerStore.getState().stopTimer();

    const remainingAfterStop = useHoldTimerStore.getState().remainingMs;
    vi.advanceTimersByTime(5000);
    // Should not have ticked since interval was cleared
    expect(useHoldTimerStore.getState().remainingMs).toBe(remainingAfterStop);
  });
});
