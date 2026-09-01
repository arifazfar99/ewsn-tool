-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Backfill: best-available approximation for invoices already PAID before
-- this column existed. updatedAt isn't a perfect proxy (it can be bumped by
-- unrelated later edits), but it's the closest real signal available and
-- only affects the one-time historical backfill - every future PAID
-- transition sets this column directly going forward (see setInvoiceStatus).
UPDATE "Invoice" SET "paidAt" = "updatedAt" WHERE "status" = 'PAID' AND "paidAt" IS NULL;
