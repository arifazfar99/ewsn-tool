import Link from "next/link";
import { prisma } from "@/lib/db";
import { QuotationStatus, Prisma } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { quotationTone } from "@/lib/statusTone";
import { buildStages, statusLine } from "@/lib/documentStage";
import { invoiceUncreditedAmount, invoiceReceiptedAmounts } from "@/lib/money";

export default async function ProjectsPage({
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

  const where: Prisma.ProjectWhereInput = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.status) where.quotation = { status: params.status as QuotationStatus };
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to + "T23:59:59.999");
  }

  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: true,
        quotation: {
          include: {
            lineItems: true,
            depositInvoice: { select: { receipt: { select: { amount: true } } } },
            deliveryOrder: { include: { invoice: { include: { receipts: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hasFilters =
    params.clientId || params.status || params.from || params.to;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Projects</h1>
        <Link href="/projects/new" className="btn-primary">
          New Project
        </Link>
      </div>

      <form
        method="get"
        className="panel mb-6 flex flex-wrap items-end gap-3 p-4"
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
          <label className="field-label">Quotation Status</label>
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
          <Link href="/projects" className="link">
            Clear filters
          </Link>
        )}
      </form>

      {projects.length === 0 ? (
        <p className="text-sm text-ink-soft">No projects yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Created</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const q = p.quotation;
                const total = q
                  ? q.lineItems.reduce((sum, line) => sum + line.lineTotal.toNumber(), 0)
                  : 0;
                const progress = q
                  ? statusLine(
                      buildStages({
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
                      })
                    )
                  : "Discussing - no quotation yet.";
                return (
                  <tr key={p.id}>
                    <td>{p.title ?? p.client.name}</td>
                    <td>{p.client.name}</td>
                    <td>{p.createdAt.toLocaleDateString("en-MY")}</td>
                    <td>
                      {q ? (
                        <StatusBadge label={q.status} tone={quotationTone[q.status]} />
                      ) : (
                        <StatusBadge label="DISCUSSING" tone="pending" />
                      )}
                    </td>
                    <td className="text-sm text-ink-soft">{progress}</td>
                    <td className="num">RM {total.toFixed(2)}</td>
                    <td className="text-right">
                      <Link href={`/projects/${p.id}`} className="link">
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
