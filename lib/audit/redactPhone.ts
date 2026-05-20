/**
 * Mask a phone number for audit-log storage: keep only the last 4 digits,
 * replace every preceding digit with a literal 'x'.
 *
 * The 'x' mask is deliberate — it prevents the masked output from matching the
 * project's PII detection regex (.gitleaks.toml: \+84[35789]\d{8}), because the
 * `\d{8}` run can never consume an 'x'. See AGENTS.md Mistake Log (Issue 001).
 *
 * Example: "+84901234567" -> "+xxxxxxx4567"
 */
export function redactPhone(phone: string): string {
  if (phone.length <= 4) return phone.replace(/\d/g, 'x');
  const head = phone.slice(0, -4).replace(/\d/g, 'x');
  return head + phone.slice(-4);
}
