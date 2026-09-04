import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { quotationTone, deliveryOrderTone, invoiceTone } from "@/lib/statusTone";
import { round2, invoiceBalanceDue } from "@/lib/money";

export default async function DashboardPage() {
  const [
    quotationCount,
    acceptedQuotationCount,
    acceptedQuotations,
    unpaidInvoices,
    pendingDepositInvoiceReceiptCount,
    pendingReceiptInvoices,
    recentQuotations,
    recentDeliveryOrders,
    recentInvoices,
  ] = await Promise.all([
    prisma.quotation.count(),
    prisma.quotation.count({ where: { status: "ACCEPTED" } }),
    prisma.quotation.findMany({
      where: { status: "ACCEPTED" },
      include: { lineItems: true, costs: true },
    }),
    prisma.invoice.findMany({
      where: { status: "UNPAID" },
      include: { lineItems: true },
    }),
    prisma.depositInvoice.count({
      where: { receivedAt: { not: null }, receipt: null },
    }),
    prisma.invoice.findMany({
      where: { status: "PAID", receipt: null },
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
      sum + invoiceBalanceDue(inv.lineItems, inv.discountAmount, inv.depositReceived),
    0
  );

  const totalSales = acceptedQuotations.reduce(
    (sum, q) =>
      sum + q.lineItems.reduce((s, line) => s + line.lineTotal.toNumber(), 0),
    0
  );

  const totalCosts = acceptedQuotations.reduce(
    (sum, q) => sum + q.costs.reduce((s, c) => s + c.amount.toNumber(), 0),
    0
  );

  const netSales = round2(totalSales - totalCosts);

  // A hand-typed depositReceived can already cover an invoice's full total
  // with no formal DepositInvoice/Receipt pair required for that money -
  // issueReceiptForInvoice blocks issuance once nothing is left, so such an
  // invoice isn't counted as pending here either (matches app/(app)/receipts).
  const pendingInvoiceReceiptCount = pendingReceiptInvoices.filter(
    (inv) => invoiceBalanceDue(inv.lineItems, inv.discountAmount, inv.depositReceived) > 0
  ).length;

  const pendingReceiptCount =
    pendingDepositInvoiceReceiptCount + pendingInvoiceReceiptCount;

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
    { label: "Accepted Quotations", value: acceptedQuotationCount },
    { label: "Total Sales", value: `RM ${totalSales.toFixed(2)}` },
    { label: "Total Costs", value: `RM ${totalCosts.toFixed(2)}` },
    {
      label: "Net Sales",
      value: `RM ${netSales.toFixed(2)}`,
      danger: netSales < 0,
    },
    { label: "Unpaid Invoices", value: unpaidInvoices.length },
    { label: "Unpaid Total", value: `RM ${unpaidTotal.toFixed(2)}` },
    {
      label: "Pending Receipts",
      value: pendingReceiptCount,
      danger: pendingReceiptCount > 0,
    },
  ];

  return (
    <div>
      <h1 className="page-title mb-6">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="eyebrow">{s.label}</p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold ${
                s.danger ? "text-danger" : "text-ink"
              }`}
            >
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
        <div className="overflow-x-auto">
        <table className="data-table">
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
                  <StatusBadge label={doc.status} tone={doc.tone} />
                </td>
                <td className="text-right">
                  <Link href={doc.href} className="link">
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
