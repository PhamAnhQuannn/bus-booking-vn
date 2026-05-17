import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('withErrorHandler', () => {
  it('passes through successful responses', async () => {
    const { withErrorHandler } = await import('../withErrorHandler');
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const wrapped = withErrorHandler(handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('catches thrown Error and returns 500 with scrubbed body', async () => {
    const { withErrorHandler } = await import('../withErrorHandler');
    const handler = vi.fn().mockRejectedValue(new Error('Prisma connection failed at 127.0.0.1:5432'));

    const wrapped = withErrorHandler(handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Internal server error' });
    // Must not contain stack trace or Prisma error details
    expect(JSON.stringify(body)).not.toContain('Prisma');
    expect(JSON.stringify(body)).not.toContain('127.0.0.1');
  });

  it('does not leak error stack in the 500 response', async () => {
    const { withErrorHandler } = await import('../withErrorHandler');
    const sensitiveError = new Error('DB password is secret123');
    const handler = vi.fn().mockRejectedValue(sensitiveError);

    const wrapped = withErrorHandler(handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    const body = await response.json();
    expect(body.error).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret123');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('handles non-Error throws (string) gracefully', async () => {
    const { withErrorHandler } = await import('../withErrorHandler');
    const handler = vi.fn().mockRejectedValue('unexpected string throw');

    const wrapped = withErrorHandler(handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
