/**
 * withErrorHandler — HOF that wraps a Next.js Route Handler.
 *
 * - Catches any thrown Error or non-Error value
 * - Logs via Pino (error level) without leaking stack/PII
 * - Returns HTTP 500 with { error: "Internal server error" }
 * - NEVER leaks Prisma error messages or stack traces to the client
 */

import type { NextRequest } from 'next/server';
import { logger } from './logger';

type Handler = (req: NextRequest) => Promise<Response>;

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      // Log internally (Pino) — never expose to client
      logger.error(
        {
          err: err instanceof Error ? { message: err.message, name: err.name } : { raw: typeof err },
        },
        'Unhandled handler error'
      );

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

