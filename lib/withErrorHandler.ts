/**
 * withErrorHandler — HOF that wraps a Next.js Route Handler.
 *
 * - Catches any thrown Error or non-Error value
 * - Reports to the error sink (captureException → Sentry / structured fallback)
 * - Returns HTTP 500 with { error: "Internal server error" }
 * - NEVER leaks Prisma error messages or stack traces to the client
 */

import type { NextRequest } from 'next/server';
import { captureException } from '@/lib/observability';

type Handler = (req: NextRequest) => Promise<Response>;

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      // Report to the error sink (#466). Previously this only logger.error'd, so every auth
      // 500 was invisible to Sentry. captureException is non-throwing and PII-scrubs its
      // context, and forwards to the structured logger when no DSN is set.
      captureException(err, { route: req.nextUrl?.pathname, method: req.method });

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

