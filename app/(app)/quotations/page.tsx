import Link from "next/link";
import { prisma } from "@/lib/db";
import { QuotationStatus, Prisma } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { quotationTone } from "@/lib/statusTone";
import { buildStages, statusLine } from "@/lib/documentStage";
import { invoiceUncreditedAmount, invoiceReceiptedAmounts } from "@/lib/money";

const PROGRESS_TONE = {
  progress: "bg-primary-soft text-primary",
  danger: "bg-danger-soft text-danger",
} as const;

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;

  const where: Prisma.QuotationWhereInput = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.status) where.status = params.status as QuotationStatus;
  if (params.from || params.to) {
    where.date = {};
    if (params.from) where.date.gte = new Date(params.from);
    if (params.to) where.date.lte = new Date(params.to + "T23:59:59.999");
  }

  const [quotations, clients] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        client: true,
        lineItems: true,
        depositInvoice: { select: { receipt: { select: { amount: true } } } },
        deliveryOrder: { include: { invoice: { include: { receipts: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hasFilters =
    params.clientId || params.status || params.from || params.to;

  return (
    <div>
      <h1 className="page-title mb-5">Quotations</h1>

      <form
        method="get"
        className="panel mb-5 flex flex-wrap items-end gap-3 p-3.5"
      >
        <div>
          <label className="field-label">Client</label>
          <select
            name="clientId"
            defaultValue={params.clientId ?? ""}
            className="field-input"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Status</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="field-input"
          >
            <option value="">All statuses</option>
            {Object.values(QuotationStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">From</label>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">To</label>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="field-input"
          />
        </div>
        <button type="submit" className="btn-primary">
          Filter
        </button>
        {hasFilters && (
          <Link href="/quotations" className="link">
            Clear filters
          </Link>
        )}
        <Link href="/projects" className="link ml-auto">
          Start a new job from Projects &rarr;
        </Link>
      </form>

      {quotations.length === 0 ? (
        <p className="text-sm text-ink-soft">No quotations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Number", "Client", "Date", "Status", "Progress"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border bg-surface-muted px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-soft"
                  >
                    {h}
                  </th>
                ))}
                <th className="border-b border-border bg-surface-muted px-4 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
                  Total
                </th>
                <th className="border-b border-border bg-surface-muted px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => {
                const total = q.lineItems.reduce(
                  (sum, line) => sum + line.lineTotal.toNumber(),
                  0
                );
                const stages = buildStages({
                  quotation: { status: q.status, acceptedAt: q.acceptedAt },
                  deliveryOrder: q.deliveryOrder
                    ? {
                        status: q.deliveryOrder.status,
                        deliveredAt: q.deliveryOrder.deliveredAt,
                        hasInvoice: q.deliveryOrder.invoice != null,
                      }
                    : null,
                  invoice: q.deliveryOrder?.invoice
                    ? {
                        status: q.deliveryOrder.invoice.status,
                        paidAt: q.deliveryOrder.invoice.paidAt,
                      }
                    : null,
                  receipt:
                    q.deliveryOrder?.invoice && q.deliveryOrder.invoice.receipts.length > 0
                      ? {
                          count: q.deliveryOrder.invoice.receipts.length,
                          latestIssuedAt: q.deliveryOrder.invoice.receipts.at(-1)?.issuedAt ?? null,
                          remaining: invoiceUncreditedAmount(
                            q.deliveryOrder.invoice.depositReceived,
                            invoiceReceiptedAmounts(
                              q.deliveryOrder.invoice.receipts,
                              q.depositInvoice?.receipt?.amount
                            )
                          ),
                        }
                      : null,
                });
                // Progress only tells you DRAFT/SENT/ACCEPTED/etc, which stays
                // "ACCEPTED" forever whether the job just started or was fully
                // paid and receipted months ago - Progress reuses the same
                // stage logic the Project hub's tracker uses so both views
                // agree on what "currently active" means.
                const progress = statusLine(stages);
                const tone =
                  stages.some((s) => s.state === "negative") ||
                  q.deliveryOrder?.invoice?.status === "UNPAID"
                    ? "danger"
                    : "progress";
                return (
                  <tr
                    key={q.id}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted/60"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {q.number ?? "DRAFT"}
                    </td>
                    <td className="px-4 py-2.5">
                      {q.client.name}
                      {q.title && (
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          {q.title}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {q.date.toLocaleDateString("en-MY")}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={q.status}
                        tone={quotationTone[q.status]}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current ${PROGRESS_TONE[tone]}`}
                      >
                        {progress}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      RM {total.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary-soft"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
