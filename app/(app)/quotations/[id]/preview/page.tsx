import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { issueQuotation } from "../../actions";
import PreviewClient from "./PreviewClient";

export default async function QuotationPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [quotation, profile] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!quotation) notFound();

  const lineItems = quotation.lineItems.map((line) => ({
    description: line.description,
    quantity: line.quantity.toNumber(),
    unitPrice: line.unitPrice.toNumber(),
    lineTotal: line.lineTotal.toNumber(),
  }));
  const total = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

  const pdfProps = {
    docTypeLabel: "QUOTATION",
    number: quotation.number,
    date: quotation.date,
    business: {
      name: profile?.name ?? "",
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      logoDataUrl: profile?.logoDataUrl ?? null,
    },
    client: {
      name: quotation.client.name,
      address: quotation.client.address,
      contactPerson: quotation.client.contactPerson,
      phone: quotation.client.phone,
      email: quotation.client.email,
    },
    lineItems,
    notes: quotation.notes,
    footerLabel: "Terms & Conditions",
    footerText: quotation.issuedAt
      ? quotation.termsText
      : (profile?.quotationTerms ?? ""),
    total,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="h1-ledger">Quotation Preview</h1>
        <div className="flex items-center gap-4">
          {quotation.issuedAt ? (
            <a
              href={`/api/documents/quotation/${quotation.id}/pdf`}
              className="btn-primary"
            >
              Download PDF
            </a>
          ) : (
            <form action={issueQuotation}>
              <input type="hidden" name="id" value={quotation.id} />
              <button type="submit" className="btn-primary">
                Generate PDF
              </button>
            </form>
          )}
        </div>
      </div>

      <PreviewClient {...pdfProps} />
    </div>
  );
}
