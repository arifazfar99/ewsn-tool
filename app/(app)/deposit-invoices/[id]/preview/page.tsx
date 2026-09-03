import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { setDepositInvoiceReceived } from "../../actions";
import { issueReceiptForDepositInvoice } from "@/app/(app)/receipts/actions";
import { StatusBadge } from "@/components/StatusBadge";
import PdfPreviewClient from "@/components/PdfPreviewClient";

export default async function DepositInvoicePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [depositInvoice, profile] = await Promise.all([
    prisma.depositInvoice.findUnique({
      where: { id },
      include: {
        sourceQuotation: { include: { client: true } },
        receipt: true,
      },
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
    language: quotation.language,
    footerLabel: "Bank Details",
    footerText: profile?.bankDetailsText ?? null,
    total: amount,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Deposit Invoice Preview</h1>
        <a
          href={`/api/documents/deposit-invoice/${depositInvoice.id}/pdf`}
          className="btn-primary"
        >
          Download PDF
        </a>
      </div>

      {error && <p className="alert-danger mb-4 max-w-3xl">{error}</p>}

      <PdfPreviewClient {...pdfProps} />

      <div className="mt-8 max-w-3xl space-y-4 border-t border-border pt-6">
        {!depositInvoice.receivedAt ? (
          <form
            action={setDepositInvoiceReceived}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="id" value={depositInvoice.id} />
            <label className="block">
              <span className="field-label">Date Received</span>
              <input
                type="date"
                name="receivedAt"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="field-input"
              />
            </label>
            <button type="submit" className="btn-secondary">
              Mark as Received
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label="RECEIVED" tone="positive" />
            <span className="text-sm text-ink-soft">
              on {depositInvoice.receivedAt.toLocaleDateString("en-MY")}
            </span>
          </div>
        )}

        {depositInvoice.receivedAt &&
          (depositInvoice.receipt ? (
            <Link
              href={`/receipts/${depositInvoice.receipt.id}/preview`}
              className="link inline-block"
            >
              View Receipt →
            </Link>
          ) : (
            <form action={issueReceiptForDepositInvoice}>
              <input type="hidden" name="depositInvoiceId" value={depositInvoice.id} />
              <button type="submit" className="btn-secondary">
                Issue Receipt
              </button>
            </form>
          ))}
      </div>
    </div>
  );
}
