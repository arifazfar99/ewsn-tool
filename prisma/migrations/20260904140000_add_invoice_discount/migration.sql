-- Add optional discount line (label + amount) to Invoice, for cases like
-- an item substitution reducing the final invoiced total.
ALTER TABLE "Invoice" ADD COLUMN "discountLabel" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "discountAmount" DECIMAL(12,2);
