// TODO: Implement in Step 12 (Security Gate)
// Stub for TypeScript during test-first Step 11.

import type { LoggerOptions } from 'pino';

export const loggerOptions: LoggerOptions = {
  level: 'info',
  redact: {
    paths: [] as string[],
    censor: '[REDACTED]',
  },
};

export const logger = {
  info: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  debug: (..._args: unknown[]) => {},
};
