import { describe, it, expect } from 'vitest';
import { FORBIDDEN_RESPONSE_FIELDS } from '../security/__tests__/forbiddenFields';

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

  it('masks all 8 Issue 007 auth PII fields', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;

    const required = [
      '*.password',
      '*.passwordHash',
      '*.otpCode',
      '*.code',
      '*.accessToken',
      '*.refreshToken',
      '*.refreshTokenHash',
      '*.codeHash',
    ];

    for (const field of required) {
      expect(redactPaths, `missing redact path: ${field}`).toContain(field);
    }
  });

  it('has top-level redact paths for phone, otp, otpProof, accessToken, refreshToken', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;

    const topLevel = ['phone', 'otp', 'otpProof', 'accessToken', 'refreshToken'];
    for (const field of topLevel) {
      expect(redactPaths, `missing top-level redact path: ${field}`).toContain(field);
    }
  });

  it('masks Issue 010 operator auth PII fields', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;

    const required = ['newPassword', 'currentPassword', 'contactPhone', 'notificationPhone'];
    for (const field of required) {
      expect(redactPaths, `missing redact path: ${field}`).toContain(field);
    }
  });

  it('masks Issue 015 manual booking PII fields (buyerPhone + buyerName)', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;

    expect(redactPaths, 'missing buyerPhone redact path').toContain('buyerPhone');
    expect(redactPaths, 'missing buyerName redact path').toContain('buyerName');
  });

  it('has redact coverage for all forbidden response fields', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;

    for (const field of FORBIDDEN_RESPONSE_FIELDS) {
      const covered =
        redactPaths.includes(field) ||
        redactPaths.includes(`*.${field}`) ||
        redactPaths.some((p: string) => p.endsWith(`.${field}`));
      expect(covered, `no logger redact path covers forbidden field: ${field}`).toBe(true);
    }
  });

  it('redact path count does not regress below baseline', async () => {
    const { loggerOptions } = await import('../logger');
    const redactPaths = Array.isArray(loggerOptions.redact)
      ? loggerOptions.redact
      : (loggerOptions.redact as { paths: string[] }).paths;
    expect(redactPaths.length).toBeGreaterThanOrEqual(45);
  });

  it('redacts buyerPhone and buyerName to [REDACTED] in pino stream output', async () => {
    const { Writable } = await import('stream');
    const pino = await import('pino');
    const { loggerOptions } = await import('../logger');

    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });

    const testLogger = pino.default({ ...loggerOptions, level: 'info' }, sink);
    testLogger.info({ buyerPhone: '0912345678', buyerName: 'Nguyen Van A' }, 'test redaction');

    // Drain the stream
    await new Promise((resolve) => setImmediate(resolve));

    const output = chunks.join('');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('0912345678');
    expect(output).not.toContain('Nguyen Van A');
  });
});
