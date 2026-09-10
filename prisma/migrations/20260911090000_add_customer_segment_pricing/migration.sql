-- Back-calculate existing catalog prices into cost prices, using the Direct
-- markup (25%) as the reference point - so a Direct-segment quotation built
-- right after this migration prices identically to what the catalog already
-- charged before it. Confirmed with Araz 2026-09-10 rather than guessed.
UPDATE "Item" SET "defaultUnitPrice" = ROUND("defaultUnitPrice" / 1.25, 2);

-- Item.defaultUnitPrice was a manually-set sell price; it now holds the
-- supplier/Shopee cost instead, with sell price computed live per customer
-- segment (see lib/pricing.ts). Rename to reflect the new meaning.
ALTER TABLE "Item" RENAME COLUMN "defaultUnitPrice" TO "costPrice";

-- CreateEnum
CREATE TYPE "CustomerSegment" AS ENUM ('DIRECT', 'SME', 'GOVERNMENT');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "customerSegment" "CustomerSegment" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "DeliveryOrder" ADD COLUMN "customerSegment" "CustomerSegment" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "customerSegment" "CustomerSegment" NOT NULL DEFAULT 'DIRECT';
