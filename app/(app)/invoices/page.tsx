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
      include: {
        client: true,
        sourceDeliveryOrder: {
          include: { sourceQuotation: { select: { projectId: true } } },
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
      <h1 className="page-title mb-5">Invoices</h1>

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
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Number", "Client", "Date", "Status", "Source Delivery Order"].map(
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
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted/60"
                >
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {inv.number ?? "DRAFT"}
                  </td>
                  <td className="px-4 py-2.5">
                    {inv.client.name}
                    {inv.title && (
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {inv.title}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {inv.date.toLocaleDateString("en-MY")}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={inv.status} tone={invoiceTone[inv.status]} />
                  </td>
                  <td className="px-4 py-2.5">
                    {inv.sourceDeliveryOrder ? (
                      <Link
                        href={`/projects/${inv.sourceDeliveryOrder.sourceQuotation?.projectId}`}
                        className="link"
                      >
                        {inv.sourceDeliveryOrder.number ?? "DRAFT"}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={
                        inv.sourceDeliveryOrder?.sourceQuotation?.projectId
                          ? `/projects/${inv.sourceDeliveryOrder.sourceQuotation.projectId}`
                          : `/invoices/${inv.id}`
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
