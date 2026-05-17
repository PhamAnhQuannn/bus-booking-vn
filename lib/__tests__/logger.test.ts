import { describe, it, expect } from 'vitest';

describe('logger redactPaths', () => {
  it('exports a logger with redactPaths configured', async () => {
    const { logger } = await import('../logger');
    expect(logger).toBeDefined();
    // logger should have a pino-compatible interface
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('logger has redactPaths for req.query', async () => {
    const { loggerOptions } = await import('../logger');
    expect(loggerOptions.redact).toBeDefined();
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;
    expect(redactPaths).toContain('req.query');
  });

  it('logger has redactPaths for req.url', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;
    expect(redactPaths).toContain('req.url');
  });

  it('logger has redactPaths for req.headers.authorization', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;
    expect(redactPaths).toContain('req.headers.authorization');
  });
});
