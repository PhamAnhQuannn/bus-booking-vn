// Vitest unit-test environment setup (issue 092b).
//
// The domain-barrel refactor (SYS20 rule-3) widens each module's transitive
// import graph: importing `@/lib/<domain>` pulls in the whole domain, including
// modules that touch `lib/core/db/client` at load time. That client throws if
// DATABASE_URL is unset. Unit tests never open a real connection (pg.Pool is
// lazy and all queries are mocked), so a dummy URL is safe and keeps module
// load-time init from throwing.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test_unit';

// SMS-OTP cutover: the SMS adapter now honors NOTIFY_STUB. Keep the unit suite
// on the no-network stub (and the OTP test sink) unless a test explicitly opts
// into the real eSMS path (NOTIFY_STUB=false + ESMS_* + _resetEnvCache). The
// schema default is already 'true', but pin it so a stray env can't leak the
// real-mode branch (and its boot-time superRefine) into unit tests.
process.env.NOTIFY_STUB ??= 'true';

// ---------------------------------------------------------------------------
// i18n (feat/i18n-en): client components now consume next-intl's React context.
// Unit tests render them in isolation without a <NextIntlClientProvider>, which
// would throw "context … was not found". Rather than wrap every render, mock the
// two client entry points globally:
//
//  - `next-intl`: `useTranslations` is backed by next-intl's OWN `createTranslator`
//    fed the REAL vi catalog, so translations resolve to real Vietnamese strings
//    (tests assert e.g. "Hiện mật khẩu") with correct nested-key + ICU behavior —
//    no reimplementation, no key-echo. `NextIntlClientProvider` becomes a passthrough.
//  - `@/i18n/navigation`: the locale-aware Link/redirect/router. next-intl's
//    createNavigation() bare-imports next/navigation's `redirect`/`permanentRedirect`,
//    which several suites' partial next/navigation mocks don't provide; stub the
//    navigation module so components get a plain <a> + no-op router in unit tests.
//
// Factories are hoisted above imports, so they load their own deps inside.
// ---------------------------------------------------------------------------
import { vi } from 'vitest';

vi.mock('next-intl', async (importActual) => {
  const actual = await importActual<typeof import('next-intl')>();
  const { viMessages } = await import('./test/viMessages');
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({ locale: 'vi', messages: viMessages as never, namespace: namespace as never }),
    useLocale: () => 'vi',
    useFormatter: () => actual.createFormatter({ locale: 'vi' }),
    NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  };
});

// Server-component translations: same real-catalog translator so server pages under unit test
// (e.g. bank-transfer/page.tsx) don't hit next-intl/server's "getTranslations is not supported
// in Client Components" guard when rendered in the happy-dom test environment.
vi.mock('next-intl/server', async (importActual) => {
  const actual = await importActual<typeof import('next-intl/server')>();
  const { createTranslator, createFormatter } = await import('next-intl');
  const { viMessages } = await import('./test/viMessages');
  return {
    ...actual,
    getTranslations: async (opts?: string | { namespace?: string }) => {
      const namespace = typeof opts === 'string' ? opts : opts?.namespace;
      return createTranslator({ locale: 'vi', messages: viMessages as never, namespace: namespace as never });
    },
    getLocale: async () => 'vi',
    getFormatter: async () => createFormatter({ locale: 'vi' }),
    setRequestLocale: () => {},
  };
});

// The locale-aware navigation wrapper. next-intl's createNavigation() bare-imports
// next/navigation's redirect/permanentRedirect (which several suites' partial next/navigation
// mocks omit → import crash). DELEGATE to next/navigation so each test's own useRouter/redirect
// spies still fire, while Link degrades to a plain <a>. `await import('next/navigation')` inside
// the (lazy) factory resolves whatever mock the importing test registered.
vi.mock('@/i18n/navigation', async () => {
  const React = await import('react');
  const nav = (await import('next/navigation')) as unknown as Record<string, ((...a: unknown[]) => unknown) | undefined>;
  return {
    Link: ({ children, href, ...rest }: { children?: unknown; href?: unknown }) =>
      React.createElement('a', { href: typeof href === 'string' ? href : '#', ...rest }, children as never),
    redirect: (...a: unknown[]) => nav.redirect?.(...a),
    permanentRedirect: (...a: unknown[]) => nav.permanentRedirect?.(...a),
    usePathname: () => (nav.usePathname?.() ?? '/') as string,
    useRouter: () => (nav.useRouter?.() ?? {}),
    getPathname: (args: unknown) =>
      typeof args === 'string' ? args : ((args as { href?: string })?.href ?? '/'),
  };
});
