import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveQuotation, setQuotationStatus } from "../actions";
import { convertQuotationToDeliveryOrder } from "../../delivery-orders/actions";
import { createDepositInvoice } from "../../deposit-invoices/actions";
import QuotationForm from "../QuotationForm";
import QuotationCostsManager from "../QuotationCostsManager";
import { StatusBadge } from "@/components/StatusBadge";
import { quotationTone } from "@/lib/statusTone";

const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  SENT: [
    { value: "ACCEPTED", label: "Accept" },
    { value: "REJECTED", label: "Reject" },
    { value: "EXPIRED", label: "Mark Expired" },
    { value: "VOIDED", label: "Void" },
  ],
  ACCEPTED: [{ value: "VOIDED", label: "Void" }],
  REJECTED: [{ value: "VOIDED", label: "Void" }],
  EXPIRED: [{ value: "VOIDED", label: "Void" }],
  VOIDED: [],
};

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      costs: { orderBy: { sortOrder: "asc" } },
      deliveryOrder: true,
      depositInvoice: true,
    },
  });
  if (!quotation) notFound();

  if (!quotation.issuedAt) {
    const [clients, items, defaultNumber, termsTemplates] = await Promise.all([
      prisma.client.findMany({ orderBy: { name: "asc" } }),
      prisma.item.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      }),
      quotation.number
        ? Promise.resolve(quotation.number)
        : previewNextDocumentNumber("QUOTATION"),
      prisma.quotationTermsTemplate.findMany({ orderBy: { name: "asc" } }),
    ]);

    return (
      <div>
        <h1 className="page-title mb-6">Edit Quotation</h1>

        {error && <p className="alert-danger mb-4 max-w-3xl">{error}</p>}

        <QuotationForm
          action={saveQuotation}
          quotationId={quotation.id}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          items={items.map((it) => ({
            id: it.id,
            name: it.name,
            unit: it.unit,
            defaultUnitPrice: it.defaultUnitPrice.toNumber(),
          }))}
          defaultClientId={quotation.clientId}
          defaultDate={quotation.date.toISOString().slice(0, 10)}
          defaultNumber={defaultNumber}
          defaultTitle={quotation.title ?? ""}
          defaultNotes={quotation.notes ?? ""}
          defaultLineItems={quotation.lineItems.map((line) => ({
            itemId: line.itemId,
            description: line.description,
            quantity: line.quantity.toNumber().toString(),
            unitPrice: line.unitPrice.toNumber().toString(),
          }))}
          termsTemplates={termsTemplates.map((t) => ({
            id: t.id,
            name: t.name,
            text: t.text,
          }))}
          defaultTermsTemplateId={quotation.termsTemplateId ?? ""}
          defaultTermsText={quotation.termsText ?? ""}
        />

        <div className="mt-8 max-w-3xl">
          <Link
            href={`/quotations/${quotation.id}/preview`}
            className="link"
          >
            Preview / Generate PDF
          </Link>
        </div>
      </div>
    );
  }

  const total = quotation.lineItems.reduce(
    (sum, line) => sum + line.lineTotal.toNumber(),
    0
  );
  const transitions = NEXT_STATUS_OPTIONS[quotation.status] ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Quotation {quotation.number}</h1>
        <StatusBadge label={quotation.status} tone={quotationTone[quotation.status]} />
      </div>

      {quotation.title && (
        <p className="mb-6 -mt-4 text-sm text-ink-soft">{quotation.title}</p>
      )}

      {error && <p className="alert-danger mb-4">{error}</p>}

      <dl className="panel mb-6 grid grid-cols-2 gap-4 p-4 text-sm">
        <div>
          <dt className="eyebrow">Client</dt>
          <dd className="mt-1 text-ink">{quotation.client.name}</dd>
        </div>
        <div>
          <dt className="eyebrow">Date</dt>
          <dd className="mt-1 text-ink">
            {quotation.date.toLocaleDateString("en-MY")}
          </dd>
        </div>
      </dl>

      <div className="overflow-x-auto">
      <table className="data-table mb-4">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {quotation.lineItems.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td className="num">{line.quantity.toNumber()}</td>
              <td className="num">RM {line.unitPrice.toNumber().toFixed(2)}</td>
              <td className="num">RM {line.lineTotal.toNumber().toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="mb-6 text-right text-sm font-medium text-ink">
        Total: <span className="font-mono">RM {total.toFixed(2)}</span>
      </p>

      {quotation.notes && (
        <div className="mb-6">
          <h2 className="eyebrow mb-1">Notes</h2>
          <p className="text-sm text-ink-soft">{quotation.notes}</p>
        </div>
      )}

      {quotation.termsText && (
        <div className="mb-6">
          <h2 className="eyebrow mb-1">Terms &amp; Conditions</h2>
          <p className="text-sm text-ink-soft">{quotation.termsText}</p>
        </div>
      )}

      <Link
        href={`/quotations/${quotation.id}/preview`}
        className="link mb-8 inline-block"
      >
        View / Download PDF
      </Link>

      <QuotationCostsManager
        quotationId={quotation.id}
        costs={quotation.costs.map((c) => ({
          id: c.id,
          label: c.label,
          amount: c.amount.toNumber(),
        }))}
        totalSales={total}
      />

      {quotation.status === "ACCEPTED" &&
        (quotation.deliveryOrder ? (
          <div className="mb-8">
            <Link
              href={`/delivery-orders/${quotation.deliveryOrder.id}`}
              className="link"
            >
              View Delivery Order &rarr;
            </Link>
          </div>
        ) : (
          <form action={convertQuotationToDeliveryOrder} className="mb-8">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <button type="submit" className="btn-secondary">
              Convert to Delivery Order
            </button>
          </form>
        ))}

      {quotation.depositInvoice ? (
        <div className="mb-8">
          <Link
            href={`/deposit-invoices/${quotation.depositInvoice.id}/preview`}
            className="link"
          >
            View Deposit Invoice &rarr;
          </Link>
        </div>
      ) : (
        quotation.status === "ACCEPTED" && (
          <form action={createDepositInvoice} className="mb-8 max-w-xs">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <label className="block">
              <span className="field-label">Deposit Amount (RM)</span>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0.01"
                defaultValue={(total * 0.5).toFixed(2)}
                className="field-input"
              />
            </label>
            <button type="submit" className="btn-secondary mt-3">
              Create Deposit Invoice
            </button>
          </form>
        ))}

      {transitions.length > 0 && (
        <form
          action={setQuotationStatus}
          className="flex flex-wrap items-center gap-2 border-t border-border pt-6"
        >
          <input type="hidden" name="id" value={quotation.id} />
          <span className="eyebrow mr-2">Change status:</span>
          {transitions.map((t) => (
            <button
              key={t.value}
              type="submit"
              name="status"
              value={t.value}
              className="btn-secondary"
            >
              {t.label}
            </button>
          ))}
        </form>
      )}
    </div>
  );
}
