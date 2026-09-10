import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { invoiceBalanceDue } from "@/lib/money";
import { saveInvoice, setInvoiceStatus } from "../actions";
import { issueReceiptForInvoice } from "@/app/(app)/receipts/actions";
import InvoiceForm from "../InvoiceForm";
import DepositForm from "../DepositForm";
import { StatusBadge } from "@/components/StatusBadge";
import { invoiceTone } from "@/lib/statusTone";

const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  DRAFT: [],
  UNPAID: [
    { value: "PAID", label: "Mark Paid" },
    { value: "VOIDED", label: "Void" },
  ],
  PAID: [
    { value: "UNPAID", label: "Mark Unpaid" },
    { value: "VOIDED", label: "Void" },
  ],
  VOIDED: [],
};

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      sourceDeliveryOrder: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      receipt: true,
    },
  });
  if (!invoice) notFound();

  const transitions = NEXT_STATUS_OPTIONS[invoice.status] ?? [];

  // Content stays editable after issuance — the one exception is once a
  // Receipt exists, since its amount is fixed at issuance and would
  // silently disagree with a later-edited invoice, same reasoning as the
  // deposit lock further down this page.
  if (!invoice.receipt) {
    const [items, defaultNumber] = await Promise.all([
      prisma.item.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      }),
      invoice.number
        ? Promise.resolve(invoice.number)
        : previewNextDocumentNumber("INVOICE"),
    ]);

    return (
      <div className="max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title">
            {invoice.issuedAt ? `Invoice ${invoice.number}` : "Edit Invoice"}
          </h1>
          {invoice.issuedAt && (
            <StatusBadge label={invoice.status} tone={invoiceTone[invoice.status]} />
          )}
        </div>

        {error && <p className="alert-danger mb-4">{error}</p>}

        <InvoiceForm
          action={saveInvoice}
          invoiceId={invoice.id}
          clientName={invoice.client.name}
          items={items.map((it) => ({
            id: it.id,
            name: it.name,
            nameMs: it.nameMs,
            unit: it.unit,
            costPrice: it.costPrice.toNumber(),
          }))}
          defaultTitle={invoice.title ?? ""}
          defaultNumber={defaultNumber}
          defaultNotes={invoice.notes ?? ""}
          defaultBankDetailsText={invoice.bankDetailsText ?? ""}
          defaultDiscountLabel={invoice.discountLabel ?? ""}
          defaultDiscountAmount={invoice.discountAmount?.toNumber().toString() ?? ""}
          language={invoice.language}
          customerSegment={invoice.customerSegment}
          defaultLineItems={invoice.lineItems.map((line) => ({
            itemId: line.itemId,
            description: line.description,
            unit: line.unit,
            quantity: line.quantity.toNumber().toString(),
            unitPrice: line.unitPrice.toNumber().toString(),
          }))}
          issued={Boolean(invoice.issuedAt)}
        />

        <DepositForm
          invoiceId={invoice.id}
          defaultDepositReceived={invoice.depositReceived?.toNumber().toString() ?? ""}
          defaultDepositReceivedAt={
            invoice.depositReceivedAt
              ? invoice.depositReceivedAt.toISOString().slice(0, 10)
              : ""
          }
        />

        {invoice.sourceDeliveryOrder && (
          <p className="mt-8 text-sm text-ink-soft">
            From delivery order{" "}
            <Link
              href={`/delivery-orders/${invoice.sourceDeliveryOrder.id}`}
              className="link"
            >
              {invoice.sourceDeliveryOrder.number ?? "DRAFT"}
            </Link>
          </p>
        )}

        {invoice.status === "PAID" && (
          <form action={issueReceiptForInvoice} className="my-6">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button type="submit" className="btn-secondary">
              Issue Receipt
            </button>
          </form>
        )}

        {transitions.length > 0 && (
          <form
            action={setInvoiceStatus}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-6 mt-6"
          >
            <input type="hidden" name="id" value={invoice.id} />
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

  const total = invoice.lineItems.reduce(
    (sum, line) => sum + line.lineTotal.toNumber(),
    0
  );
  const hasDiscount = invoice.discountAmount != null;
  const balanceDue = invoiceBalanceDue(
    invoice.lineItems,
    invoice.discountAmount,
    invoice.depositReceived
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Invoice {invoice.number}</h1>
        <StatusBadge label={invoice.status} tone={invoiceTone[invoice.status]} />
      </div>

      {invoice.title && (
        <p className="mb-6 -mt-4 text-sm text-ink-soft">{invoice.title}</p>
      )}

      {error && <p className="alert-danger mb-4">{error}</p>}

      <dl className="panel mb-6 grid grid-cols-2 gap-4 p-4 text-sm">
        <div>
          <dt className="eyebrow">Client</dt>
          <dd className="mt-1 text-ink">{invoice.client.name}</dd>
        </div>
        <div>
          <dt className="eyebrow">Date</dt>
          <dd className="mt-1 text-ink">
            {invoice.date.toLocaleDateString("en-MY")}
          </dd>
        </div>
        {invoice.sourceDeliveryOrder && (
          <div>
            <dt className="eyebrow">Source Delivery Order</dt>
            <dd className="mt-1 text-ink">
              <Link
                href={`/delivery-orders/${invoice.sourceDeliveryOrder.id}`}
                className="link"
              >
                {invoice.sourceDeliveryOrder.number ?? "DRAFT"}
              </Link>
            </dd>
          </div>
        )}
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
          {invoice.lineItems.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td className="num">
                {line.unit
                  ? `${line.quantity.toNumber()} ${line.unit}`
                  : line.quantity.toNumber()}
              </td>
              <td className="num">RM {line.unitPrice.toNumber().toFixed(2)}</td>
              <td className="num">RM {line.lineTotal.toNumber().toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className={`text-right text-sm font-medium text-ink ${hasDiscount ? "mb-2" : "mb-6"}`}>
        {hasDiscount ? "Subtotal" : "Total"}:{" "}
        <span className="font-mono">RM {total.toFixed(2)}</span>
      </p>

      {hasDiscount && (
        <p className="mb-2 text-right text-sm text-ink-soft">
          Discount — {invoice.discountLabel}:{" "}
          <span className="font-mono">
            -RM {invoice.discountAmount!.toNumber().toFixed(2)}
          </span>
        </p>
      )}

      {hasDiscount && invoice.depositReceived == null && (
        <p className="mb-6 text-right text-sm font-medium text-ink">
          Total: <span className="font-mono">RM {balanceDue.toFixed(2)}</span>
        </p>
      )}

      {invoice.notes && (
        <div className="mb-6">
          <h2 className="eyebrow mb-1">Notes</h2>
          <p className="text-sm text-ink-soft">{invoice.notes}</p>
        </div>
      )}

      {invoice.bankDetailsText && (
        <div className="mb-6">
          <h2 className="eyebrow mb-1">Bank Details</h2>
          <p className="whitespace-pre-line text-sm text-ink-soft">
            {invoice.bankDetailsText}
          </p>
        </div>
      )}

      {invoice.depositReceived != null && (
        <div className="mb-6">
          <h2 className="eyebrow mb-1">Deposit</h2>
          <p className="text-sm text-ink-soft">
            RM {invoice.depositReceived.toNumber().toFixed(2)} received
            {invoice.depositReceivedAt &&
              ` on ${invoice.depositReceivedAt.toLocaleDateString("en-MY")}`}
          </p>
          <p className="text-sm font-medium text-ink">
            Balance Due: RM {balanceDue.toFixed(2)}
          </p>
        </div>
      )}

      <Link
        href={`/invoices/${invoice.id}/preview`}
        className="link mb-8 inline-block"
      >
        View / Download PDF
      </Link>

      {/* A Receipt's amount is computed once at issuance from the deposit
          and line items at that moment - editing either afterward would make
          the already-issued receipt (and its PDF) silently disagree with
          this page, so both are locked once a receipt exists. */}
      <p className="max-w-3xl border-t border-border pt-6 text-sm text-ink-soft">
        Content and deposit locked - a receipt has already been issued for this invoice.
      </p>

      <Link
        href={`/receipts/${invoice.receipt!.id}/preview`}
        className="link my-6 block"
      >
        View Receipt →
      </Link>

      {transitions.length > 0 && (
        <form
          action={setInvoiceStatus}
          className="flex flex-wrap items-center gap-2 border-t border-border pt-6"
        >
          <input type="hidden" name="id" value={invoice.id} />
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
