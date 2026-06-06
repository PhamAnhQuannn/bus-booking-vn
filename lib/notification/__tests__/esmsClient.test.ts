import { describe, it, expect, vi, afterEach } from 'vitest';

// Override getEnv with deterministic eSMS creds (importOriginal-spread so any
// other consumer of @/lib/config in the graph still resolves real exports).
const fakeEnv = {
  ESMS_API_KEY: 'test-api-key',
  ESMS_SECRET_KEY: 'test-secret-key',
  ESMS_BRANDNAME: 'BusBookVN',
  ESMS_OTP_SMSTYPE: '2',
  ESMS_SANDBOX: true,
  ESMS_BASE_URL: 'https://esms.test',
};
vi.mock('@/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config')>()),
  getEnv: () => fakeEnv,
}));

import { postEsms, toEsmsPhone } from '../esmsClient';

describe('toEsmsPhone', () => {
  it('strips the leading + from an E.164 number', () => {
    expect(toEsmsPhone('+84901234567')).toBe('84901234567');
  });
  it('passes through an already-84 number', () => {
    expect(toEsmsPhone('84901234567')).toBe('84901234567');
  });
});

describe('postEsms', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('CodeResult "100" → ok with SMSID externalRef + correct request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ CodeResult: '100', SMSID: 'sms-123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await postEsms({ phone: '+84901234567', content: 'hi', smsType: '2', requestId: 'req-1' });
    expect(res).toEqual({ ok: true, externalRef: 'sms-123' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://esms.test/MainService.svc/json/SendMultipleMessage_V4_post_json/');
    const body = JSON.parse(init.body as string);
    expect(body.Phone).toBe('84901234567'); // + stripped
    expect(body.IsUnicode).toBe('0'); // ASCII bodies
    expect(body.Sandbox).toBe('1'); // ESMS_SANDBOX=true
    expect(body.RequestId).toBe('req-1');
    expect(body.Brandname).toBe('BusBookVN');
    expect(body.SmsType).toBe('2');
    expect(body.ApiKey).toBe('test-api-key');
  });

  it('non-100 CodeResult → ok:false with an error string', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: async () => ({ CodeResult: '104', ErrorMessage: 'invalid brandname' }) })
    );
    const res = await postEsms({ phone: '+84901234567', content: 'x', smsType: '2', requestId: 'r' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('104');
  });

  it('never throws on a network/fetch error → ok:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const res = await postEsms({ phone: '+84901234567', content: 'x', smsType: '2', requestId: 'r' });
    expect(res).toEqual({ ok: false, error: 'boom' });
  });

  it('truncates RequestId to eSMS 50-char limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ CodeResult: '100', SMSID: 's' }) });
    vi.stubGlobal('fetch', fetchMock);
    await postEsms({ phone: '+84901234567', content: 'x', smsType: '2', requestId: 'a'.repeat(80) });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.RequestId).toHaveLength(50);
  });
});
