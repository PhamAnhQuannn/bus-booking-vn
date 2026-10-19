import { describe, it, expect } from 'vitest';
import { metadata as authMetadata } from '../layout';
import { generateMetadata as loginMeta } from '../login/layout';
import { generateMetadata as registerMeta } from '../register/layout';
import { generateMetadata as forgotMeta } from '../forgot-password/layout';
import { generateMetadata as resetMeta } from '../reset-password/layout';
import { generateMetadata as accountMeta } from '../../account/layout';

// vitest.setup.ts backs getTranslations with the real vi catalog.
const params = Promise.resolve({ locale: 'vi' });

describe('customer auth/account metadata', () => {
  it('auth subtree is noindex (matches robots.ts /auth/ disallow)', () => {
    expect(authMetadata.robots).toEqual({ index: false, follow: false });
  });

  it('each auth page has a localized title', async () => {
    expect((await loginMeta({ params })).title).toBe('Đăng nhập | BBVN');
    expect((await registerMeta({ params })).title).toBe('Đăng ký | BBVN');
    expect((await forgotMeta({ params })).title).toBe('Quên mật khẩu | BBVN');
    expect((await resetMeta({ params })).title).toBe('Đặt lại mật khẩu | BBVN');
  });

  it('account layout keeps noindex with a localized title', async () => {
    const m = await accountMeta({ params });
    expect(m.title).toBe('Tài khoản | BBVN');
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
