import Link from "next/link";
import { prisma } from "@/lib/db";
import { QuotationStatus, Prisma } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { quotationTone } from "@/lib/statusTone";

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
      include: { client: true, lineItems: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hasFilters =
    params.clientId || params.status || params.from || params.to;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Quotations</h1>
        <Link href="/quotations/new" className="btn-primary">
          New Quotation
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
      </form>

      {quotations.length === 0 ? (
        <p className="text-sm text-ink-soft">No quotations yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => {
              const total = q.lineItems.reduce(
                (sum, line) => sum + line.lineTotal.toNumber(),
                0
              );
              return (
                <tr key={q.id}>
                  <td className="num">{q.number ?? "DRAFT"}</td>
                  <td>
                    {q.client.name}
                    {q.title && (
                      <span className="block text-xs text-ink-soft">
                        {q.title}
                      </span>
                    )}
                  </td>
                  <td>{q.date.toLocaleDateString("en-MY")}</td>
                  <td>
                    <StatusBadge
                      label={q.status}
                      tone={quotationTone[q.status]}
                    />
                  </td>
                  <td className="num">RM {total.toFixed(2)}</td>
                  <td className="text-right">
                    <Link href={`/quotations/${q.id}`} className="link">
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
