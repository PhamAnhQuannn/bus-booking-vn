/**
 * #842: free-text Sentry scrub — emails + VN phones in exception values, message and
 * breadcrumbs (message + data). Fixtures are synthetic (example.com, allowlisted doc number).
 */

import { describe, it, expect } from 'vitest';
import { scrubText, scrubSentryEvent } from '../sentryScrub';

describe('scrubText', () => {
  it('masks emails and VN phone shapes', () => {
    expect(scrubText('user rider@example.com failed')).toBe('user [email] failed');
    for (const phone of ['+84901234567', '0912 345 678', '090.000.0001', '84912-345-678']) {
      expect(scrubText(`call ${phone} now`)).toBe('call [phone] now');
    }
  });

  it('leaves long digit runs (order ids / txn refs) and plain text intact', () => {
    expect(scrubText('txn 2026101409123456789 ok')).toBe('txn 2026101409123456789 ok');
    expect(scrubText('BB-2026-ABC123 seat 12')).toBe('BB-2026-ABC123 seat 12');
  });
});

describe('scrubSentryEvent', () => {
  it('scrubs message, exception values and breadcrumb message + nested data', () => {
    const event = {
      message: 'notify rider@example.com',
      exception: { values: [{ type: 'Error', value: 'Unique failed for +84901234567' }, {}] },
      breadcrumbs: [
        {
          message: 'POST /api/x by 0912 345 678',
          data: { url: '/api/x?email=rider@example.com', nested: { list: ['0912345678', 3] } },
        },
        { category: 'ui.click' },
      ],
      extra: { untouched: 'rider@example.com' },
    };

    const out = scrubSentryEvent(event);

    expect(out).toBe(event); // mutate-and-return (beforeSend contract)
    expect(out.message).toBe('notify [email]');
    expect(out.exception.values[0].value).toBe('Unique failed for [phone]');
    expect(out.exception.values[0].type).toBe('Error');
    expect(out.breadcrumbs[0].message).toBe('POST /api/x by [phone]');
    expect(out.breadcrumbs[0].data).toEqual({
      url: '/api/x?email=[email]',
      nested: { list: ['[phone]', 3] },
    });
    expect(out.breadcrumbs[1]).toEqual({ category: 'ui.click' });
    // extra/contexts are the key-based scrubPii's job — not touched here.
    expect(out.extra.untouched).toBe('rider@example.com');
  });

  it('tolerates an empty event and circular breadcrumb data', () => {
    expect(scrubSentryEvent({})).toEqual({});
    const data: Record<string, unknown> = { a: 'x' };
    data.self = data;
    const out = scrubSentryEvent({ breadcrumbs: [{ data }] });
    expect(out.breadcrumbs[0].data).toEqual({ a: 'x', self: '[Circular]' });
  });
});
