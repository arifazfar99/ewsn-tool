import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import PreviewClient from "./PreviewClient";

export default async function ReceiptPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [receipt, profile] = await Promise.all([
    prisma.receipt.findUnique({
      where: { id },
      include: {
        sourceDepositInvoice: {
          include: { sourceQuotation: { include: { client: true } } },
        },
        sourceInvoice: { include: { client: true } },
      },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!receipt) notFound();

  const amount = receipt.amount.toNumber();

  let client: {
    name: string;
    address: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
  };
  let description: string;

  if (receipt.sourceDepositInvoice?.sourceQuotation) {
    const quotation = receipt.sourceDepositInvoice.sourceQuotation;
    client = quotation.client;
    description = `Deposit received for Quotation ${quotation.number}${
      quotation.title ? ` — ${quotation.title}` : ""
    } (Deposit Invoice ${receipt.sourceDepositInvoice.number})`;
  } else if (receipt.sourceInvoice) {
    client = receipt.sourceInvoice.client;
    description = `Payment received for Invoice ${receipt.sourceInvoice.number}`;
  } else {
    notFound();
  }

  const pdfProps = {
    docTypeLabel: "RECEIPT",
    number: receipt.number,
    date: receipt.date,
    business: {
      name: profile?.name ?? "",
      ssmNumber: profile?.ssmNumber ?? "",
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      logoDataUrl: profile?.logoDataUrl ?? null,
    },
    client: {
      name: client.name,
      address: client.address,
      contactPerson: client.contactPerson,
      phone: client.phone,
      email: client.email,
    },
    lineItems: [
      {
        description,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
    ],
    title: null,
    notes: null,
    footerLabel: null,
    footerText: null,
    total: amount,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="h1-ledger">Receipt Preview</h1>
        <a href={`/api/documents/receipt/${receipt.id}/pdf`} className="btn-primary">
          Download PDF
        </a>
      </div>

      <PreviewClient {...pdfProps} />
    </div>
  );
}
