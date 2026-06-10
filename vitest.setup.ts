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
