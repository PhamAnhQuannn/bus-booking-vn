-- CreateEnum
CREATE TYPE "OperatorRole" AS ENUM ('admin');

-- CreateTable
CREATE TABLE "OperatorUser" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "notificationPhone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "role" "OperatorRole" NOT NULL DEFAULT 'admin',
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorSession" (
    "id" TEXT NOT NULL,
    "operatorUserId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "tokenFamily" TEXT NOT NULL,
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OperatorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorOtpAttempt" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "OperatorOtpAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorUser_phone_key" ON "OperatorUser"("phone");

-- CreateIndex
CREATE INDEX "OperatorUser_createdAt_idx" ON "OperatorUser"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorSession_refreshTokenHash_key" ON "OperatorSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "OperatorSession_operatorUserId_idx" ON "OperatorSession"("operatorUserId");

-- CreateIndex
CREATE INDEX "OperatorOtpAttempt_phone_createdAt_idx" ON "OperatorOtpAttempt"("phone", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "OperatorUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
