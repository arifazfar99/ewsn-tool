-- AlterTable
ALTER TABLE "QuotationLineItem" ADD COLUMN "unit" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "DeliveryOrderLineItem" ADD COLUMN "unit" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN "unit" TEXT NOT NULL DEFAULT '';
