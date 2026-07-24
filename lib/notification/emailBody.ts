/**
 * Email body renderer — turns a stored NotificationLog payload into a branded
 * HTML body + a plain-text fallback.
 *
 * Why this exists: the dispatcher stores ONE payload string per row and hands it
 * to sendEmail unchanged (no re-render — see esms.ts sendSmsBody). For SMS that
 * string IS the message. For email that produced two defects:
 *   1. `ticketReady` stores a structured JSON blob ({bookingRef,verifyUrl,ticketUrl})
 *      → the customer received raw JSON.
 *   2. Every other template stored an SMS line → a plain, unbranded, ASCII email.
 *
 * This module wraps whatever it's given in one BBVN-branded HTML shell and, for
 * the structured `ticketReady` payload, renders proper CTA buttons. It NEVER
 * throws — a render failure degrades to the raw text so email delivery is never
 * blocked by a formatting bug (mirrors the "never throw" contract of the adapters).
 *
 * Links: cron-enqueued rows (ticketReady, reconcile) carry relative/bare URLs
 * because a cron has no request host. We resolve them against PUBLIC_BASE_URL
 * (default https://lenxevn.com) so the buttons are clickable in a mail client.
 */

import { SUPPORT_EMAIL } from '@/lib/notification/esms';

const BRAND = '#ea580c'; // primary orange (matches the site --primary token)
const BRAND_DARK = '#c2410c';

/** Public site origin for absolute links. Read from process.env directly (not
 *  getEnv) so this module never triggers full env-schema validation in unit
 *  contexts — same rationale as email.ts emailStubbed(). */
function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'https://lenxevn.com');
}

/** Resolve a possibly-relative URL/token to an absolute https URL. */
function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = publicBaseUrl();
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Cta {
  label: string;
  url: string;
}

/** A labeled detail row (label → value), e.g. Hành khách → Nguyễn Văn A. */
type DetailRow = [label: string, value: string];

/** Render detail rows as a two-column table (muted label / bold value). */
function detailTable(rows: DetailRow[]): string {
  const body = rows
    .filter(([, v]) => v != null && String(v).trim().length > 0)
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:7px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:7px 0 7px 16px;font-size:14px;color:#1f2937;font-weight:600;text-align:right;">${escapeHtml(value)}</td>` +
        `</tr>`,
    )
    .join('');
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;margin:4px 0 8px;">${body}</table>`
  );
}

/** Compose the branded HTML shell. Table-based + inline styles for mail clients. */
function shell(opts: {
  title: string;
  bodyLines: string[];
  detailHtml?: string;
  ctas?: Cta[];
}): string {
  const { title, bodyLines, detailHtml = '', ctas = [] } = opts;
  const logoUrl = `${publicBaseUrl()}/brand/logo-horizontal-white.png`;

  const paras = bodyLines
    .filter((l) => l.trim().length > 0)
    .map(
      (l) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1f2937;">${escapeHtml(l)}</p>`,
    )
    .join('');

  const buttons = ctas
    .map(
      (c) =>
        `<a href="${escapeHtml(c.url)}" style="display:inline-block;margin:4px 8px 4px 0;padding:11px 22px;` +
        `background:${BRAND};color:#ffffff;text-decoration:none;border-radius:8px;` +
        `font-size:15px;font-weight:600;">${escapeHtml(c.label)}</a>`,
    )
    .join('');

  const ctaBlock = buttons
    ? `<div style="margin:20px 0 4px;">${buttons}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="background:${BRAND};padding:20px 28px;">
        <img src="${logoUrl}" alt="BusBookVN" width="140" style="display:block;border:0;height:auto;">
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:${BRAND_DARK};">${escapeHtml(title)}</h1>
        ${paras}
        ${detailHtml}
        ${ctaBlock}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
          Hỗ trợ: <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_DARK};text-decoration:none;">${SUPPORT_EMAIL}</a><br>
          BusBookVN — lenxevn.com
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Strip the "BusBookVN — " / "BBVN — " / "BBVN OPS — " prefix from a subject to
 *  reuse it as an in-body title. */
function titleFromSubject(subject: string): string {
  return subject.replace(/^(?:BusBookVN|BBVN(?:\s+OPS)?)\s*[—-]\s*/u, '').trim() || 'Thông báo';
}

/** Per-template CTA label for the URL pulled out of a plain-text SMS body. */
const CTA_LABEL: Record<string, string> = {
  customerBookingPaid: 'Xem xác nhận',
  bookingPendingCash: 'Xem xác nhận',
};

const URL_RE = /(https?:\/\/[^\s]+)/;

export interface RenderedEmail {
  html: string;
  text: string;
}

/**
 * Render a branded HTML body + plain-text fallback for an email.
 *
 * @param template  NotificationLog template name.
 * @param payload   The stored payload string (SMS text, or a JSON blob for
 *                  structured templates like `ticketReady`), or a structured
 *                  object from a direct caller.
 * @param subject   The resolved subject line (reused as the in-body title).
 */
export function renderEmailBody(
  template: string,
  payload: string | Record<string, string | number>,
  subject: string,
): RenderedEmail {
  try {
    // --- ticketReady: structured payload → labeled detail table + button ----
    if (template === 'ticketReady') {
      const data =
        typeof payload === 'string'
          ? (JSON.parse(payload) as Record<string, string>)
          : (payload as Record<string, string>);
      const val = (k: string) => (data[k] == null ? '' : String(data[k]));

      const rows: DetailRow[] = [
        ['Mã đặt chỗ', val('bookingRef')],
        ['Hành khách', val('buyerName')],
        ['Tuyến', val('route')],
        ['Khởi hành', val('departureAt')],
        ['Số vé', val('ticketCount')],
        ['Xe', val('vehicle')],
        ['Nhà xe', val('operator')],
        ['Tổng tiền', val('amount')],
      ];

      const ctas: Cta[] = [];
      if (data.ticketUrl) ctas.push({ label: 'Xem vé', url: absolute(val('ticketUrl')) });

      const bodyLines = ['Vé điện tử của bạn đã sẵn sàng. Chi tiết chuyến đi bên dưới.'];
      const text =
        `Vé điện tử của bạn đã sẵn sàng.\n` +
        rows.filter(([, v]) => v.trim()).map(([l, v]) => `${l}: ${v}`).join('\n') +
        (ctas.length ? `\nXem vé: ${ctas[0].url}` : '') +
        `\nHỗ trợ: ${SUPPORT_EMAIL}`;

      return {
        html: shell({
          title: 'Vé điện tử đã sẵn sàng',
          bodyLines,
          detailHtml: detailTable(rows),
          ctas,
        }),
        text,
      };
    }

    // --- text templates: SMS line → shell, pull a URL out as a button -------
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const match = raw.match(URL_RE);
    let bodyText = raw;
    const ctas: Cta[] = [];
    if (match) {
      const url = match[1].replace(/[.,;]+$/, '');
      ctas.push({ label: CTA_LABEL[template] ?? 'Xem chi tiết', url: absolute(url) });
      // Drop the "Xac nhan: <url>" tail so the URL isn't duplicated in the body.
      bodyText = raw.replace(URL_RE, '').replace(/(Xac nhan|Xác nhận)\s*:?\s*$/iu, '').trim();
    }

    return {
      html: shell({ title: titleFromSubject(subject), bodyLines: [bodyText], ctas }),
      text: raw,
    };
  } catch {
    // Never let a formatting bug block delivery — fall back to the raw string.
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return { html: shell({ title: titleFromSubject(subject), bodyLines: [text] }), text };
  }
}
