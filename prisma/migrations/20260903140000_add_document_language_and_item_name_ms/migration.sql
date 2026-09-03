-- CreateEnum
CREATE TYPE "DocumentLanguage" AS ENUM ('EN', 'MS');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "nameMs" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "language" "DocumentLanguage" NOT NULL DEFAULT 'EN';
ALTER TABLE "DeliveryOrder" ADD COLUMN "language" "DocumentLanguage" NOT NULL DEFAULT 'EN';
ALTER TABLE "Invoice" ADD COLUMN "language" "DocumentLanguage" NOT NULL DEFAULT 'EN';
