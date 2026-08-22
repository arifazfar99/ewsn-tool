-- AlterTable
ALTER TABLE "DepositInvoice" ADD COLUMN "receivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "year" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "sourceDepositInvoiceId" TEXT,
    "sourceInvoiceId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_sourceDepositInvoiceId_key" ON "Receipt"("sourceDepositInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_sourceInvoiceId_key" ON "Receipt"("sourceInvoiceId");

-- AddForeignKey
-- ON DELETE RESTRICT (not the usual SET NULL for an optional source relation):
-- SET NULL would leave both source columns null on delete, which the CHECK
-- constraint below forbids - RESTRICT fails the delete cleanly instead of
-- hitting a raw constraint-violation error.
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_sourceDepositInvoiceId_fkey" FOREIGN KEY ("sourceDepositInvoiceId") REFERENCES "DepositInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
-- Enforce exactly one source (DepositInvoice XOR Invoice). App-level checks
-- in the issuing actions are the first line of defense; this is the
-- backstop, same rationale as the unique conversion-chain FKs elsewhere.
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_exactly_one_source_check" CHECK (num_nonnulls("sourceDepositInvoiceId", "sourceInvoiceId") = 1);
