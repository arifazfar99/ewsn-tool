-- CreateTable
CREATE TABLE "DepositInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "year" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "sourceQuotationId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositInvoice_number_key" ON "DepositInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "DepositInvoice_sourceQuotationId_key" ON "DepositInvoice"("sourceQuotationId");

-- AddForeignKey
ALTER TABLE "DepositInvoice" ADD CONSTRAINT "DepositInvoice_sourceQuotationId_fkey" FOREIGN KEY ("sourceQuotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "depositReceived" DECIMAL(12,2);
ALTER TABLE "Invoice" ADD COLUMN "depositReceivedAt" TIMESTAMP(3);
