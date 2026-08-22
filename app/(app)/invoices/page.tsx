import Link from "next/link";
import { prisma } from "@/lib/db";
import { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { invoiceTone } from "@/lib/statusTone";

export default async function InvoicesPage({
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

  const where: Prisma.InvoiceWhereInput = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.status) where.status = params.status as InvoiceStatus;
  if (params.from || params.to) {
    where.date = {};
    if (params.from) where.date.gte = new Date(params.from);
    if (params.to) where.date.lte = new Date(params.to + "T23:59:59.999");
  }

  const [invoices, clients] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { client: true, sourceDeliveryOrder: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hasFilters =
    params.clientId || params.status || params.from || params.to;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Invoices</h1>
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
          <label className="field-label">Status</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="field-input"
          >
            <option value="">All statuses</option>
            {Object.values(InvoiceStatus).map((s) => (
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
          <Link href="/invoices" className="link">
            Clear filters
          </Link>
        )}
      </form>

      {invoices.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No invoices yet. Convert an issued delivery order to create one.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Date</th>
              <th>Status</th>
              <th>Source Delivery Order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="num">{inv.number ?? "DRAFT"}</td>
                <td>
                  {inv.client.name}
                  {inv.title && (
                    <span className="block text-xs text-ink-soft">
                      {inv.title}
                    </span>
                  )}
                </td>
                <td>{inv.date.toLocaleDateString("en-MY")}</td>
                <td>
                  <StatusBadge label={inv.status} tone={invoiceTone[inv.status]} />
                </td>
                <td>
                  {inv.sourceDeliveryOrder ? (
                    <Link
                      href={`/delivery-orders/${inv.sourceDeliveryOrder.id}`}
                      className="link"
                    >
                      {inv.sourceDeliveryOrder.number ?? "DRAFT"}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="text-right">
                  <Link href={`/invoices/${inv.id}`} className="link">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
