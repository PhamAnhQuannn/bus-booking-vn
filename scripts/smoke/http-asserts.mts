// Read-only HTTP asserts for GET /api/trips/search — extracted from scripts/fresh-boot-smoke.sh
// WITHOUT its migrate+seed prelude (HG-C: never seed a non-disposable DB from a smoke run).
// Uses fetch (no jq/curl dependency). Safe against any target (pure GET).
export type Check = { name: string; ok: boolean; detail?: string; optional?: boolean };

const CONTRACT_FIELDS = [
  'tripId', 'departureAt', 'price', 'availableSeats',
  'operatorLegalName', 'routeOrigin', 'routeDestination',
];

export async function httpAsserts(baseUrl: string): Promise<Check[]> {
  const out: Check[] = [];
  // Vietnam business date (Asia/Ho_Chi_Minh, UTC+7) — trip search filters by local date, so a naive
  // UTC "tomorrow" can miss/skew near 00:00–07:00 UTC. Shift +7h before taking the date.
  const VN_OFFSET_MS = 7 * 3600_000;
  const tomorrow = new Date(Date.now() + VN_OFFSET_MS + 86_400_000).toISOString().slice(0, 10);
  const q = new URLSearchParams({ origin: 'Hà Nội', destination: 'TP.HCM', date: tomorrow, ticketCount: '1' });
  const url = `${baseUrl}/api/trips/search?${q}`;

  // 1. 200 + JSON array + Cache-Control: no-store
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  out.push({ name: 'search 200', ok: res.status === 200, detail: `status=${res.status}` });
  const cc = res.headers.get('cache-control') ?? '';
  out.push({ name: 'search Cache-Control no-store', ok: /no-store/i.test(cc), detail: cc });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* leave null */ }
  const isArray = Array.isArray(body);
  out.push({ name: 'search body is array', ok: isArray });

  // 2. field shape if any result
  if (isArray && (body as unknown[]).length > 0) {
    const first = (body as Record<string, unknown>[])[0];
    const missing = CONTRACT_FIELDS.filter((f) => first[f] === undefined);
    out.push({ name: 'search result contract fields', ok: missing.length === 0, detail: missing.join(',') });
  }

  // 3. 400 on empty origin
  const bad = await fetch(`${baseUrl}/api/trips/search?origin=&destination=TP.HCM&date=${tomorrow}&ticketCount=1`);
  out.push({ name: 'search 400 on empty origin', ok: bad.status === 400, detail: `status=${bad.status}` });

  // 4. homepage + health (read-only GET)
  const home = await fetch(`${baseUrl}/`);
  out.push({ name: 'homepage 200', ok: home.status === 200, detail: `status=${home.status}` });
  const health = await fetch(`${baseUrl}/api/health`);
  out.push({ name: 'health 200', ok: health.status === 200, detail: `status=${health.status}` });

  return out;
}
