import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import PreviewClient from "./PreviewClient";

export default async function DepositInvoicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [depositInvoice, profile] = await Promise.all([
    prisma.depositInvoice.findUnique({
      where: { id },
      include: { sourceQuotation: { include: { client: true } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!depositInvoice || !depositInvoice.sourceQuotation) notFound();

  const quotation = depositInvoice.sourceQuotation;
  const amount = depositInvoice.amount.toNumber();

  const pdfProps = {
    docTypeLabel: "DEPOSIT INVOICE",
    number: depositInvoice.number,
    date: depositInvoice.date,
    business: {
      name: profile?.name ?? "",
      ssmNumber: profile?.ssmNumber ?? "",
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
    lineItems: [
      {
        description: `Deposit for Quotation ${quotation.number}${
          quotation.title ? ` — ${quotation.title}` : ""
        }`,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
    ],
    title: null,
    notes: null,
    footerLabel: "Bank Details",
    footerText: profile?.bankDetailsText ?? null,
    total: amount,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="h1-ledger">Deposit Invoice Preview</h1>
        <a
          href={`/api/documents/deposit-invoice/${depositInvoice.id}/pdf`}
          className="btn-primary"
        >
          Download PDF
        </a>
      </div>

      <PreviewClient {...pdfProps} />
    </div>
  );
}
