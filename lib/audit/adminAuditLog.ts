/**
 * Append-only audit trail for platform-admin CLI write actions (Issue 020).
 *
 * Takes the Prisma client as a parameter (reuse-by-param) so the same core runs
 * under the CLI's own PrismaClient and under a test client without importing the
 * app's singleton — keeps this module Next.js-free for the node-only CLI.
 */

export interface AdminAuditLogClient {
  adminAuditLog: {
    create: (args: {
      data: { actor: string; action: string; target: string; argsRedacted?: string | null };
    }) => Promise<unknown>;
  };
}

export interface AdminAuditLogInput {
  actor: string;
  action: string;
  target: string;
  /** Command args with phone numbers already masked via redactPhone(). */
  argsRedacted?: string | null;
}

export async function writeAdminAuditLog(
  prisma: AdminAuditLogClient,
  input: AdminAuditLogInput
): Promise<void> {
  await prisma.adminAuditLog.create({ data: input });
}
