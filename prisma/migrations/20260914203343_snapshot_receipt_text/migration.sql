-- Snapshots a Receipt's printed description/notes at issuance instead of
-- recomputing them live from the invoice's current state on every PDF
-- download (see issueReceiptForInvoice / the PDF route). Both nullable -
-- existing rows have neither and the PDF route falls back to the old live
-- computation for those.
ALTER TABLE "Receipt" ADD COLUMN "description" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "notes" TEXT;
