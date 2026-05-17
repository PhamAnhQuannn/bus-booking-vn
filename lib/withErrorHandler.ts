// TODO: Implement in Step 12 (Security Gate)
// Stub for TypeScript during test-first Step 11.

import type { NextRequest } from 'next/server';

type Handler = (req: NextRequest) => Promise<Response>;

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest) => {
    // Stub — just calls the handler, no error wrapping yet.
    return handler(req);
  };
}
