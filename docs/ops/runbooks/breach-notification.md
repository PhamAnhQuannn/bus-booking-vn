# Data Breach Notification Runbook

Maps to HD-007 (PDPL 2025). Pre-written so notification timelines are met under pressure.
**This is a procedure draft — the tabletop exercise has NOT been run (see status below).**

## Trigger
Any confirmed or suspected unauthorized access, disclosure, loss, or alteration of personal data
(customer/operator/payout/admin) — including: leaked secret, exposed DB, malicious cron abuse,
credential compromise, lost backup.

## Timelines (Vietnam)
| Path | Deadline | To |
|------|----------|-----|
| PDPL personal-data breach | **72 hours** from awareness | Ministry of Public Security (MPS) A05, via the A05 form |
| Cyberattack / system incident | **24 hours** | MPS (parallel, if attack-driven) |
| Payment-data incident | in parallel | SBV / payment partner (SePay) per their agreement |
| Affected data subjects | without undue delay | notify affected customers/operators |

## Response steps
1. **Contain** — rotate the affected secret immediately (`docs/ops/secrets-rotation.md`); revoke sessions;
   isolate the exposed surface (disable the route/cron, Vercel firewall rule if needed).
2. **Assess** — scope: which data categories (see `docs/compliance/pii-inventory.md`), how many subjects,
   window. Pull `JobRunLog` + access logs for the exposure period.
3. **Notify** — file the MPS A05 form within 72h (24h if cyberattack); notify SePay if payment data;
   draft the data-subject notice (what happened, what data, what they should do).
4. **Remediate** — close the root cause; forward-fix; add a regression guard/test.
5. **Record** — post-incident note in `docs/ops/` (timeline, cause, data, notifications sent, fixes).

## Data-subject notice template
> Kính gửi Quý khách, chúng tôi phát hiện một sự cố an ninh vào [ngày] có thể ảnh hưởng tới [loại dữ liệu].
> Chúng tôi đã [hành động khắc phục]. Quý khách nên [đổi mật khẩu / theo dõi tài khoản]. Liên hệ: [DPO/contact].

## Decision authority
Primary maintainer (family op) triggers containment immediately on suspicion; legal/regulatory filing
in consultation with counsel.

## Tabletop exercise
**STATUS: NOT YET EXECUTED.** Schedule one dry-run (simulate a leaked `BANK_ENCRYPTION_KEY`): walk
containment → assessment → the 72h MPS filing draft → data-subject notice, and time it. Mark done here
only after the exercise runs.
