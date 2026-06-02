-- Issue 054: Admin auth core (THIRD auth realm). Distinct tables — never reuse
-- Customer/Operator. Accounts are invite-only (issue 057); no registration path.

-- 1. Enums
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'FINANCE', 'SUPPORT');
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- 2. AdminUser table
CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL,
  "totpSecret" TEXT,
  "totpEnabledAt" TIMESTAMP(3),
  "invitedBy" TEXT,
  "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- @unique on email → Prisma-named unique index. The explicit @@index([email])
-- → a second plain index. Both declared here to keep schema↔SQL parity (Issue 007).
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- 3. AdminSession table — parallel refresh-token store for the admin realm
--    (OperatorSession is FK-bound to OperatorUser; admin sessions get their own).
CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "tokenFamily" TEXT NOT NULL,
  "rotationCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSession_refreshTokenHash_key" ON "AdminSession"("refreshTokenHash");
CREATE INDEX "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");

ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
