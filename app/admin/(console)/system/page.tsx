/**
 * /admin/system — admin System tab (Issue 070). React Server Component.
 *
 * Reads everything in-process (NEVER self-fetch — Issue 002/003) and mounts the
 * <SystemActions> client islands for the mutating POSTs (each step-up gated +
 * CSRF'd + audited via the /api/admin/system/* + /api/admin/admins routes).
 *
 * ── ROLE MATRIX ──────────────────────────────────────────────────────────────
 *   Feature flags toggle  : SUPER_ADMIN + FINANCE   (rail toggles / kill-switches)
 *   Admin accounts (CRUD) : SUPER_ADMIN only         (invite / revoke / change-role)
 *   Audit log view        : ALL admin roles          (read-only)
 *   Audit CSV export      : SUPER_ADMIN + FINANCE     (GET /system/audit/export)
 * The page renders each section per the viewer's role; a viewer lacking a section's
 * role sees a notice (accounts) or the section is simply omitted (flag toggles fall
 * back to a read-only state badge). The routes enforce the authoritative gate — the
 * page-level checks are presentation only.
 *
 * RSC PURITY (Issue 016): no Date.now() / non-deterministic calls in the render
 * body — timestamps come from each row's own value, rendered via a pure formatter.
 */

import { requireAdminPage } from '@/lib/auth/requireAdminPage';
import { prisma } from '@/lib/core/db/client';
import { getFlag } from '@/lib/flags/flags';
import { FLAG_KEYS } from '@/lib/flags/keys';
import { listAdmins, type AdminRow } from '@/lib/admin/listAdmins';
import { getAuditLog, type AuditLogRow } from '@/lib/admin/getAuditLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FlagToggle,
  InviteAdminForm,
  RevokeAdminButton,
  ChangeRoleControl,
} from './SystemActions';

const FLAG_ENTRIES = Object.values(FLAG_KEYS);

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
}

const ADMIN_STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'danger'> = {
  ACTIVE: 'success',
  DISABLED: 'danger',
};

export default async function AdminSystemPage() {
  const ctx = await requireAdminPage();
  const canToggleFlags = ctx.role === 'SUPER_ADMIN' || ctx.role === 'FINANCE';
  const canManageAdmins = ctx.role === 'SUPER_ADMIN';

  // In-process reads. Flags + audit are read for every role; the admin list is
  // only read when the viewer may manage accounts (avoids surfacing the admin
  // roster to SUPPORT roles that can't act on it).
  const [flagStates, admins, audit] = await Promise.all([
    Promise.all(
      FLAG_ENTRIES.map(async (key) => ({ key, enabled: await getFlag(key, undefined, prisma) }))
    ),
    canManageAdmins ? listAdmins(prisma) : Promise.resolve<AdminRow[]>([]),
    getAuditLog({ limit: 50 }, prisma),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">System</h1>
        <p className="text-sm text-muted-foreground">
          Feature flags, admin accounts, and the immutable audit log. Mutating actions require
          re-authentication (step-up).
        </p>
      </header>

      {/* ── Feature flags ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Feature flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 font-medium">Key</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 font-medium">{canToggleFlags ? 'Action' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {flagStates.map((f) => (
                <tr key={f.key} className="border-b border-border/50" data-testid={`flag-row-${f.key}`}>
                  <td className="py-1 font-mono text-xs">{f.key}</td>
                  <td className="py-1">
                    <Badge variant={f.enabled ? 'success' : 'neutral'}>
                      {f.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </td>
                  <td className="py-1">
                    {canToggleFlags ? (
                      <FlagToggle flagKey={f.key} enabled={f.enabled} />
                    ) : (
                      <span className="text-xs text-muted-foreground">read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!canToggleFlags ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Toggling flags is restricted to SUPER_ADMIN and FINANCE roles.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Admin accounts (SUPER_ADMIN only) ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Admin accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManageAdmins ? (
            <Alert variant="warning">
              <AlertTitle>Insufficient role</AlertTitle>
              <AlertDescription>
                Admin-account management is restricted to the SUPER_ADMIN role.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="border-b border-border pb-4">
                <h3 className="mb-2 text-sm font-semibold">Invite an admin</h3>
                <InviteAdminForm />
              </div>

              {admins.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admin accounts.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1 font-medium">Email</th>
                      <th className="py-1 font-medium">Role</th>
                      <th className="py-1 font-medium">Status</th>
                      <th className="py-1 font-medium">TOTP</th>
                      <th className="py-1 font-medium">Created</th>
                      <th className="py-1 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a) => (
                      <tr key={a.id} className="border-b border-border/50" data-testid={`admin-row-${a.id}`}>
                        <td className="py-1">{a.email}</td>
                        <td className="py-1">{a.role}</td>
                        <td className="py-1">
                          <Badge variant={ADMIN_STATUS_VARIANT[a.status] ?? 'neutral'}>{a.status}</Badge>
                        </td>
                        <td className="py-1 text-muted-foreground">{formatDate(a.totpEnabledAt)}</td>
                        <td className="py-1 text-muted-foreground">{formatDate(a.createdAt)}</td>
                        <td className="py-1">
                          <div className="flex flex-col gap-2">
                            <ChangeRoleControl adminId={a.id} currentRole={a.role} />
                            <RevokeAdminButton adminId={a.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Audit log (all roles read) ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Audit log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Most recent {audit.items.length} entries.</p>
            {canToggleFlags ? (
              <a
                href="/api/admin/system/audit/export"
                className="min-h-9 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/40"
                data-testid="audit-export-link"
              >
                Export CSV
              </a>
            ) : null}
          </div>

          {audit.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 font-medium">Timestamp</th>
                  <th className="py-1 font-medium">Actor</th>
                  <th className="py-1 font-medium">Action</th>
                  <th className="py-1 font-medium">Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.items.map((row: AuditLogRow) => (
                  <tr key={row.id} className="border-b border-border/50" data-testid={`audit-row-${row.id}`}>
                    <td className="py-1 font-mono text-xs">{formatDate(row.timestamp)}</td>
                    <td className="py-1 font-mono text-xs">{row.actor}</td>
                    <td className="py-1">{row.action}</td>
                    <td className="py-1 font-mono text-xs text-muted-foreground">{row.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
