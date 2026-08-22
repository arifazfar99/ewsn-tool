import Link from "next/link";
import { prisma } from "@/lib/db";
import { DeliveryOrderStatus, Prisma } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { deliveryOrderTone } from "@/lib/statusTone";

export default async function DeliveryOrdersPage({
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

  const where: Prisma.DeliveryOrderWhereInput = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.status) where.status = params.status as DeliveryOrderStatus;
  if (params.from || params.to) {
    where.date = {};
    if (params.from) where.date.gte = new Date(params.from);
    if (params.to) where.date.lte = new Date(params.to + "T23:59:59.999");
  }

  const [deliveryOrders, clients] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where,
      include: { client: true, sourceQuotation: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hasFilters =
    params.clientId || params.status || params.from || params.to;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Delivery Orders</h1>
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
            {Object.values(DeliveryOrderStatus).map((s) => (
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
          <Link href="/delivery-orders" className="link">
            Clear filters
          </Link>
        )}
      </form>

      {deliveryOrders.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No delivery orders yet. Convert an accepted quotation to create one.
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
              <th>Source Quotation</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deliveryOrders.map((d) => (
              <tr key={d.id}>
                <td className="num">{d.number ?? "DRAFT"}</td>
                <td>
                  {d.client.name}
                  {d.title && (
                    <span className="block text-xs text-ink-soft">
                      {d.title}
                    </span>
                  )}
                </td>
                <td>{d.date.toLocaleDateString("en-MY")}</td>
                <td>
                  <StatusBadge
                    label={d.status}
                    tone={deliveryOrderTone[d.status]}
                  />
                </td>
                <td>
                  {d.sourceQuotation ? (
                    <Link
                      href={`/quotations/${d.sourceQuotation.id}`}
                      className="link"
                    >
                      {d.sourceQuotation.number ?? "DRAFT"}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="text-right">
                  <Link href={`/delivery-orders/${d.id}`} className="link">
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
