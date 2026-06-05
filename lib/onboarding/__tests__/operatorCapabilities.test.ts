/**
 * Issue 045: unit tests for the operator capability helper (pure function).
 */

import { describe, it, expect } from 'vitest';
import type { OperatorStatus } from '@prisma/client';
import {
  getOperatorCapabilities,
  SEARCH_VISIBLE_STATUSES,
  BOOKABLE_STATUSES,
  isSearchVisible,
  isBookable,
} from '../operatorCapabilities';

describe('getOperatorCapabilities', () => {
  it('PENDING_REVIEW = login + draft only', () => {
    expect(getOperatorCapabilities('PENDING_REVIEW')).toEqual({
      canLogin: true,
      searchVisible: false,
      canSell: false,
      canPayout: false,
      canResubmit: false,
      listingsHidden: false,
    });
  });

  it('UNDER_REVIEW = login + draft only (same as pending)', () => {
    expect(getOperatorCapabilities('UNDER_REVIEW')).toEqual({
      canLogin: true,
      searchVisible: false,
      canSell: false,
      canPayout: false,
      canResubmit: false,
      listingsHidden: false,
    });
  });

  it('APPROVED = full capability', () => {
    expect(getOperatorCapabilities('APPROVED')).toEqual({
      canLogin: true,
      searchVisible: true,
      canSell: true,
      canPayout: true,
      canResubmit: false,
      listingsHidden: false,
    });
  });

  it('REJECTED = login + resubmit only', () => {
    expect(getOperatorCapabilities('REJECTED')).toEqual({
      canLogin: true,
      searchVisible: false,
      canSell: false,
      canPayout: false,
      canResubmit: true,
      listingsHidden: false,
    });
  });

  it('SUSPENDED = login + listings hidden, no sell/search/payout', () => {
    expect(getOperatorCapabilities('SUSPENDED')).toEqual({
      canLogin: true,
      searchVisible: false,
      canSell: false,
      canPayout: false,
      canResubmit: false,
      listingsHidden: true,
    });
  });
});

describe('derived status sets (single source of truth)', () => {
  it('SEARCH_VISIBLE_STATUSES is exactly [APPROVED]', () => {
    expect(SEARCH_VISIBLE_STATUSES).toEqual(['APPROVED']);
  });

  it('BOOKABLE_STATUSES is exactly [APPROVED]', () => {
    expect(BOOKABLE_STATUSES).toEqual(['APPROVED']);
  });

  it('isSearchVisible / isBookable agree with the helper for every state', () => {
    const all: OperatorStatus[] = [
      'PENDING_REVIEW',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'SUSPENDED',
    ];
    for (const s of all) {
      expect(isSearchVisible(s)).toBe(getOperatorCapabilities(s).searchVisible);
      expect(isBookable(s)).toBe(getOperatorCapabilities(s).canSell);
    }
  });
});
