import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveQuotation, setQuotationStatus } from "../actions";
import { convertQuotationToDeliveryOrder } from "../../delivery-orders/actions";
import QuotationForm from "../QuotationForm";
import { StatusStamp } from "@/components/StatusStamp";
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
      deliveryOrder: true,
    },
  });
  if (!quotation) notFound();

  if (!quotation.issuedAt) {
    const [clients, items, defaultNumber] = await Promise.all([
      prisma.client.findMany({ orderBy: { name: "asc" } }),
      prisma.item.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      }),
      quotation.number
        ? Promise.resolve(quotation.number)
        : previewNextDocumentNumber("QUOTATION"),
    ]);

    return (
      <div>
        <h1 className="h1-ledger mb-6">Edit Quotation</h1>

        {error && (
          <p className="stamp stamp-negative mb-4 !block max-w-3xl !text-left">
            {error}
          </p>
        )}

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
        />

        <div className="mt-8 max-w-3xl">
          <Link
            href={`/quotations/${quotation.id}/preview`}
            className="link-ink"
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
        <h1 className="h1-ledger">Quotation {quotation.number}</h1>
        <StatusStamp label={quotation.status} tone={quotationTone[quotation.status]} />
      </div>

      {quotation.title && (
        <p className="mb-6 -mt-4 text-sm text-ink-soft">{quotation.title}</p>
      )}

      {error && (
        <p className="stamp stamp-negative mb-4 !block !text-left">
          {error}
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-ink-soft">Client</dt>
          <dd className="text-ink">{quotation.client.name}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Date</dt>
          <dd className="text-ink">
            {quotation.date.toLocaleDateString("en-MY")}
          </dd>
        </div>
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

      <p className="mb-6 text-right text-sm font-medium text-ink">
        Total: RM {total.toFixed(2)}
      </p>

      {quotation.notes && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium text-ink">Notes</h2>
          <p className="text-sm text-ink-soft">{quotation.notes}</p>
        </div>
      )}

      <Link
        href={`/quotations/${quotation.id}/preview`}
        className="link-ink mb-8 inline-block"
      >
        View / Download PDF
      </Link>

      {quotation.status === "ACCEPTED" &&
        (quotation.deliveryOrder ? (
          <div className="mb-8">
            <Link
              href={`/delivery-orders/${quotation.deliveryOrder.id}`}
              className="link-ink"
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

      {transitions.length > 0 && (
        <form
          action={setQuotationStatus}
          className="flex flex-wrap items-center gap-2 border-t border-paper-line pt-6"
        >
          <input type="hidden" name="id" value={quotation.id} />
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
