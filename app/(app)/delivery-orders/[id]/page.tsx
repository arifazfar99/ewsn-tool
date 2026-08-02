import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { saveDeliveryOrder, setDeliveryOrderStatus } from "../actions";
import { convertDeliveryOrderToInvoice } from "../../invoices/actions";
import DeliveryOrderForm from "../DeliveryOrderForm";
import { StatusStamp } from "@/components/StatusStamp";
import { deliveryOrderTone } from "@/lib/statusTone";

const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  DRAFT: [
    { value: "DELIVERED", label: "Mark Delivered" },
    { value: "VOIDED", label: "Void" },
  ],
  DELIVERED: [{ value: "VOIDED", label: "Void" }],
  VOIDED: [],
};

export default async function DeliveryOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const deliveryOrder = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      client: true,
      sourceQuotation: true,
      invoice: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!deliveryOrder) notFound();

  if (!deliveryOrder.issuedAt) {
    const items = await prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    });

    return (
      <div>
        <h1 className="h1-ledger mb-6">Edit Delivery Order</h1>

        {error && (
          <p className="stamp stamp-negative mb-4 !block max-w-3xl !text-left">
            {error}
          </p>
        )}

        <DeliveryOrderForm
          action={saveDeliveryOrder}
          deliveryOrderId={deliveryOrder.id}
          clientName={deliveryOrder.client.name}
          items={items.map((it) => ({
            id: it.id,
            name: it.name,
            unit: it.unit,
            defaultUnitPrice: it.defaultUnitPrice.toNumber(),
          }))}
          defaultNotes={deliveryOrder.notes ?? ""}
          defaultLineItems={deliveryOrder.lineItems.map((line) => ({
            itemId: line.itemId,
            description: line.description,
            quantity: line.quantity.toNumber().toString(),
            unitPrice: line.unitPrice.toNumber().toString(),
          }))}
        />

        <div className="mt-8 max-w-3xl space-y-2">
          {deliveryOrder.sourceQuotation && (
            <p className="text-sm text-ink-soft">
              From quotation{" "}
              <Link
                href={`/quotations/${deliveryOrder.sourceQuotation.id}`}
                className="link-ink"
              >
                {deliveryOrder.sourceQuotation.number ?? "DRAFT"}
              </Link>
            </p>
          )}
          <Link
            href={`/delivery-orders/${deliveryOrder.id}/preview`}
            className="link-ink inline-block"
          >
            Preview / Generate PDF
          </Link>
        </div>
      </div>
    );
  }

  const total = deliveryOrder.lineItems.reduce(
    (sum, line) => sum + line.lineTotal.toNumber(),
    0
  );
  const transitions = NEXT_STATUS_OPTIONS[deliveryOrder.status] ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="h1-ledger">
          Delivery Order {deliveryOrder.number}
        </h1>
        <StatusStamp
          label={deliveryOrder.status}
          tone={deliveryOrderTone[deliveryOrder.status]}
        />
      </div>

      {error && (
        <p className="stamp stamp-negative mb-4 !block !text-left">{error}</p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="eyebrow">Client</dt>
          <dd className="mt-1 text-ink">{deliveryOrder.client.name}</dd>
        </div>
        <div>
          <dt className="eyebrow">Date</dt>
          <dd className="mt-1 text-ink">
            {deliveryOrder.date.toLocaleDateString("en-MY")}
          </dd>
        </div>
        {deliveryOrder.sourceQuotation && (
          <div>
            <dt className="eyebrow">Source Quotation</dt>
            <dd className="mt-1 text-ink">
              <Link
                href={`/quotations/${deliveryOrder.sourceQuotation.id}`}
                className="link-ink"
              >
                {deliveryOrder.sourceQuotation.number ?? "DRAFT"}
              </Link>
            </dd>
          </div>
        )}
      </dl>

      <table className="table-ledger mb-4">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {deliveryOrder.lineItems.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td className="num">{line.quantity.toNumber()}</td>
              <td className="num">
                RM {line.unitPrice.toNumber().toFixed(2)}
              </td>
              <td className="num">
                RM {line.lineTotal.toNumber().toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mb-6 text-right font-mono text-sm font-medium text-ink">
        Total: RM {total.toFixed(2)}
      </p>

      {deliveryOrder.notes && (
        <div className="mb-6">
          <h2 className="eyebrow mb-1">Notes</h2>
          <p className="text-sm text-ink-soft">{deliveryOrder.notes}</p>
        </div>
      )}

      <Link
        href={`/delivery-orders/${deliveryOrder.id}/preview`}
        className="link-ink mb-4 inline-block"
      >
        View / Download PDF
      </Link>

      <div className="mb-8">
        {deliveryOrder.invoice ? (
          <Link
            href={`/invoices/${deliveryOrder.invoice.id}`}
            className="link-ink"
          >
            View Invoice &rarr;
          </Link>
        ) : (
          deliveryOrder.issuedAt &&
          deliveryOrder.status !== "VOIDED" && (
            <form action={convertDeliveryOrderToInvoice}>
              <input type="hidden" name="deliveryOrderId" value={deliveryOrder.id} />
              <button type="submit" className="btn-secondary">
                Convert to Invoice
              </button>
            </form>
          )
        )}
      </div>

      {transitions.length > 0 && (
        <form
          action={setDeliveryOrderStatus}
          className="flex flex-wrap items-center gap-2 border-t border-paper-line pt-6"
        >
          <input type="hidden" name="id" value={deliveryOrder.id} />
          <span className="mr-2 text-sm font-medium text-ink">
            Change status:
          </span>
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
