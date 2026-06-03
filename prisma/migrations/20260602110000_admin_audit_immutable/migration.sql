-- Issue 062: enforce AdminAuditLog append-only at the DB level (SYS13/S10).
--
-- Convention-only immutability is not enough for an audit trail — a compromised
-- app role (or a buggy migration) could rewrite history. Same approach as the
-- LedgerEntry immutability (issue 047): a BEFORE UPDATE/DELETE trigger that
-- RAISEs, chosen over a role REVOKE because the app connects via a single pooled
-- role (Neon) that typically owns the table — a trigger is role-independent and
-- directly assertable from the app connection.
--
-- Prisma-DSL-invisible (SQL-only) object, same exception class as partial indices
-- (Issue 007) / CHECK constraints (Issue 020) / the LedgerEntry trigger (047).
-- schema.prisma is unchanged; schema↔DB stay in parity.

CREATE OR REPLACE FUNCTION "admin_audit_log_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "admin_audit_log_no_update" BEFORE UPDATE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION "admin_audit_log_immutable"();

CREATE TRIGGER "admin_audit_log_no_delete" BEFORE DELETE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION "admin_audit_log_immutable"();
