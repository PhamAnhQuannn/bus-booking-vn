import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildCookieValue,
  buildSetCookieHeader,
  verifyCookieValue,
  extractHoldCookie,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
} from '../holdCookie';

const FAKE_SECRET = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('holdCookie', () => {
  beforeEach(() => {
    process.env.HOLD_SECRET = FAKE_SECRET;
  });

  afterEach(() => {
    delete process.env.HOLD_SECRET;
  });

  const holdId = 'clxyz1234567890abcdef';
  const expiresAtISO = '2026-05-17T12:00:00.000Z';

  describe('buildCookieValue', () => {
    it('produces a three-segment string <holdId>.<expiresAt>.<sig>', () => {
      const value = buildCookieValue(holdId, expiresAtISO);
      const segments = value.split('.');
      // holdId + expiresAt (has dots from ISO format split) + sig
      // The last segment is the signature (base64url, no dots inside)
      expect(value.startsWith(holdId)).toBe(true);
      expect(value).toContain(expiresAtISO);
      // base64url sig at end (no slashes, no plusses, no equals)
      const sig = segments[segments.length - 1];
      expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('is deterministic given same inputs', () => {
      expect(buildCookieValue(holdId, expiresAtISO)).toBe(
        buildCookieValue(holdId, expiresAtISO)
      );
    });

    it('changes when holdId changes', () => {
      expect(buildCookieValue('other_hold_id', expiresAtISO)).not.toBe(
        buildCookieValue(holdId, expiresAtISO)
      );
    });

    it('throws if HOLD_SECRET is absent', () => {
      delete process.env.HOLD_SECRET;
      expect(() => buildCookieValue(holdId, expiresAtISO)).toThrow('HOLD_SECRET');
    });

    it('throws if HOLD_SECRET is too short', () => {
      process.env.HOLD_SECRET = 'abcd1234'; // only 8 chars
      expect(() => buildCookieValue(holdId, expiresAtISO)).toThrow('HOLD_SECRET');
    });
  });

  describe('buildSetCookieHeader', () => {
    it('contains HttpOnly and SameSite=Lax', () => {
      const header = buildSetCookieHeader(holdId, expiresAtISO);
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Lax');
    });

    it('sets Max-Age to COOKIE_MAX_AGE (720)', () => {
      const header = buildSetCookieHeader(holdId, expiresAtISO);
      expect(header).toContain(`Max-Age=${COOKIE_MAX_AGE}`);
    });

    it('starts with correct cookie name', () => {
      const header = buildSetCookieHeader(holdId, expiresAtISO);
      expect(header.startsWith(`${COOKIE_NAME}=`)).toBe(true);
    });

    it('does NOT include Secure in test environment (NODE_ENV=test)', () => {
      // NODE_ENV is "test" in vitest, not "production"
      const header = buildSetCookieHeader(holdId, expiresAtISO);
      expect(header).not.toContain('Secure');
    });
  });

  describe('verifyCookieValue', () => {
    it('returns holdId and expiresAtISO for a valid cookie', () => {
      const value = buildCookieValue(holdId, expiresAtISO);
      const result = verifyCookieValue(value);
      expect(result).not.toBeNull();
      expect(result!.holdId).toBe(holdId);
      expect(result!.expiresAtISO).toBe(expiresAtISO);
    });

    it('returns null for tampered signature', () => {
      const value = buildCookieValue(holdId, expiresAtISO);
      const tampered = value.slice(0, -3) + 'xxx';
      expect(verifyCookieValue(tampered)).toBeNull();
    });

    it('returns null for tampered holdId', () => {
      const value = buildCookieValue(holdId, expiresAtISO);
      // Replace holdId portion with a different ID
      const tampered = 'different_id' + value.slice(holdId.length);
      expect(verifyCookieValue(tampered)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(verifyCookieValue('')).toBeNull();
    });

    it('returns null for malformed string (no dots)', () => {
      expect(verifyCookieValue('nodots')).toBeNull();
    });

    it('returns null if HOLD_SECRET changes (cross-secret forgery attempt)', () => {
      const value = buildCookieValue(holdId, expiresAtISO);
      // Change secret
      process.env.HOLD_SECRET = 'b'.repeat(64);
      expect(verifyCookieValue(value)).toBeNull();
    });
  });

  describe('extractHoldCookie', () => {
    it('extracts and verifies from a Cookie header string', () => {
      const cookieValue = buildCookieValue(holdId, expiresAtISO);
      const cookieHeader = `other_cookie=foo; ${COOKIE_NAME}=${cookieValue}; another=bar`;
      const result = extractHoldCookie(cookieHeader);
      expect(result).not.toBeNull();
      expect(result!.holdId).toBe(holdId);
    });

    it('returns null for null header', () => {
      expect(extractHoldCookie(null)).toBeNull();
    });

    it('returns null when bb_hold cookie is absent', () => {
      expect(extractHoldCookie('other=cookie')).toBeNull();
    });

    it('returns null when bb_hold cookie is present but tampered', () => {
      const tampered = 'tampered_value';
      expect(extractHoldCookie(`${COOKIE_NAME}=${tampered}`)).toBeNull();
    });
  });
});
