-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- Backfill: best-available approximation for rows already in the target
-- state before these columns existed. Same accepted limitation as
-- Invoice.paidAt's own backfill - only affects this one-time historical
-- pass, every future transition sets these columns directly going forward
-- (see setQuotationStatus / setDeliveryOrderStatus).
UPDATE "Quotation" SET "acceptedAt" = "updatedAt" WHERE "status" = 'ACCEPTED' AND "acceptedAt" IS NULL;
UPDATE "DeliveryOrder" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;
