-- CreateTable
CREATE TABLE "QuotationTermsTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationTermsTemplate_pkey" PRIMARY KEY ("id")
);

-- DataMigration: seed the existing global terms text as the first, default template.
-- Fixed literal id (matches this app's cuid-shaped ids everywhere else; there is no
-- SQL-level cuid() function, and this INSERT only ever creates the one seed row).
INSERT INTO "QuotationTermsTemplate" ("id", "name", "text", "isDefault", "createdAt", "updatedAt")
SELECT 'cm0seedstandardtemplate01', 'Standard', "quotationTerms", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BusinessProfile"
WHERE "id" = 'singleton';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "termsTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "Quotation_termsTemplateId_idx" ON "Quotation"("termsTemplateId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_termsTemplateId_fkey" FOREIGN KEY ("termsTemplateId") REFERENCES "QuotationTermsTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "BusinessProfile" DROP COLUMN "quotationTerms";
