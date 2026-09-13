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
      include: {
        client: true,
        sourceQuotation: { select: { id: true, number: true, projectId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hasFilters =
    params.clientId || params.status || params.from || params.to;

  return (
    <div>
      <h1 className="page-title mb-5">Delivery Orders</h1>

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
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Number", "Client", "Date", "Status", "Source Quotation"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-border bg-surface-muted px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-soft"
                    >
                      {h}
                    </th>
                  )
                )}
                <th className="border-b border-border bg-surface-muted px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {deliveryOrders.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted/60"
                >
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {d.number ?? "DRAFT"}
                  </td>
                  <td className="px-4 py-2.5">
                    {d.client.name}
                    {d.title && (
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {d.title}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {d.date.toLocaleDateString("en-MY")}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      label={d.status}
                      tone={deliveryOrderTone[d.status]}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {d.sourceQuotation ? (
                      <Link
                        href={`/projects/${d.sourceQuotation.projectId}`}
                        className="link"
                      >
                        {d.sourceQuotation.number ?? "DRAFT"}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={
                        d.sourceQuotation
                          ? `/projects/${d.sourceQuotation.projectId}`
                          : `/delivery-orders/${d.id}`
                      }
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary-soft"
                    >
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
