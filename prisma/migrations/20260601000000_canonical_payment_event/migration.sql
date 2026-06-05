ALTER TABLE "PaymentEvent" RENAME COLUMN "externalRef" TO "providerTxnId";
ALTER TABLE "PaymentEvent" DROP COLUMN "resultCode";
ALTER TABLE "PaymentEvent" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'VND';
ALTER INDEX "PaymentEvent_adapter_externalRef_key" RENAME TO "PaymentEvent_adapter_providerTxnId_key";
