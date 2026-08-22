-- CreateTable
CREATE TABLE "QuotationCost" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationCost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuotationCost" ADD CONSTRAINT "QuotationCost_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
