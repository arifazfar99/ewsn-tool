import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { issueInvoice } from "../../actions";
import PdfPreviewClient from "@/components/PdfPreviewClient";

export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, profile] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!invoice) notFound();

  const lineItems = invoice.lineItems.map((line) => ({
    description: line.description,
    quantity: line.quantity.toNumber(),
    unitPrice: line.unitPrice.toNumber(),
    lineTotal: line.lineTotal.toNumber(),
  }));
  const total = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

  const pdfProps = {
    docTypeLabel: "INVOICE",
    number: invoice.number,
    date: invoice.date,
    business: {
      name: profile?.name ?? "",
      ssmNumber: profile?.ssmNumber ?? "",
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      logoDataUrl: profile?.logoDataUrl ?? null,
    },
    client: {
      name: invoice.client.name,
      address: invoice.client.address,
      contactPerson: invoice.client.contactPerson,
      phone: invoice.client.phone,
      email: invoice.client.email,
    },
    lineItems,
    title: invoice.title,
    notes: invoice.notes,
    language: invoice.language,
    footerLabel: "Bank Details",
    footerText: invoice.bankDetailsText,
    total,
    discountLabel: invoice.discountLabel,
    discountAmount: invoice.discountAmount?.toNumber() ?? null,
    depositReceived: invoice.depositReceived?.toNumber() ?? null,
    depositReceivedAt: invoice.depositReceivedAt ?? null,
    showThankYou: true,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Invoice Preview</h1>
        <div className="flex items-center gap-4">
          {invoice.issuedAt ? (
            <a
              href={`/api/documents/invoice/${invoice.id}/pdf`}
              className="btn-primary"
            >
              Download PDF
            </a>
          ) : (
            <form action={issueInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="btn-primary">
                Generate PDF
              </button>
            </form>
          )}
        </div>
      </div>

      <PdfPreviewClient {...pdfProps} />
    </div>
  );
}
