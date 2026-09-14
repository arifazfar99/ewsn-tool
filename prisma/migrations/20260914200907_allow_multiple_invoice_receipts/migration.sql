-- Allow an Invoice to have more than one Receipt (one per payment
-- installment received), matching Receipt.sourceInvoiceId no longer being
-- unique in schema.prisma. No data loss, no column type change.
DROP INDEX "Receipt_sourceInvoiceId_key";
