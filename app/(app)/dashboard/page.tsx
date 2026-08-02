import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusStamp } from "@/components/StatusStamp";
import { quotationTone, deliveryOrderTone, invoiceTone } from "@/lib/statusTone";

export default async function DashboardPage() {
  const [
    quotationCount,
    deliveryOrderCount,
    invoiceCount,
    unpaidInvoices,
    recentQuotations,
    recentDeliveryOrders,
    recentInvoices,
  ] = await Promise.all([
    prisma.quotation.count(),
    prisma.deliveryOrder.count(),
    prisma.invoice.count(),
    prisma.invoice.findMany({
      where: { status: "UNPAID" },
      include: { lineItems: true },
    }),
    prisma.quotation.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { client: true },
    }),
    prisma.deliveryOrder.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { client: true },
    }),
    prisma.invoice.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { client: true },
    }),
  ]);

  const unpaidTotal = unpaidInvoices.reduce(
    (sum, inv) =>
      sum +
      inv.lineItems.reduce((s, line) => s + line.lineTotal.toNumber(), 0),
    0
  );

  const recent = [
    ...recentQuotations.map((q) => ({
      type: "Quotation",
      number: q.number,
      client: q.client.name,
      title: q.title,
      status: q.status,
      tone: quotationTone[q.status],
      createdAt: q.createdAt,
      href: `/quotations/${q.id}`,
    })),
    ...recentDeliveryOrders.map((d) => ({
      type: "Delivery Order",
      number: d.number,
      client: d.client.name,
      title: d.title,
      status: d.status,
      tone: deliveryOrderTone[d.status],
      createdAt: d.createdAt,
      href: `/delivery-orders/${d.id}`,
    })),
    ...recentInvoices.map((inv) => ({
      type: "Invoice",
      number: inv.number,
      client: inv.client.name,
      title: inv.title,
      status: inv.status,
      tone: invoiceTone[inv.status],
      createdAt: inv.createdAt,
      href: `/invoices/${inv.id}`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  const stats = [
    { label: "Quotations", value: quotationCount },
    { label: "Delivery Orders", value: deliveryOrderCount },
    { label: "Invoices", value: invoiceCount },
    { label: "Unpaid Total", value: `RM ${unpaidTotal.toFixed(2)}` },
  ];

  return (
    <div>
      <h1 className="h1-ledger mb-6">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="eyebrow">{s.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-ink">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">
        Recent Documents
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-ink-soft">No documents yet.</p>
      ) : (
        <table className="table-ledger">
          <thead>
            <tr>
              <th>Type</th>
              <th>Number</th>
              <th>Client</th>
              <th>Title</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {recent.map((doc) => (
              <tr key={doc.href}>
                <td className="text-ink-soft">{doc.type}</td>
                <td className="num">{doc.number ?? "DRAFT"}</td>
                <td className="text-ink-soft">{doc.client}</td>
                <td className="text-ink-soft">{doc.title ?? "—"}</td>
                <td>
                  <StatusStamp label={doc.status} tone={doc.tone} />
                </td>
                <td className="text-right">
                  <Link href={doc.href} className="link-ink">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
