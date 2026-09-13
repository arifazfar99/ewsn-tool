import Link from "next/link";
import { prisma } from "@/lib/db";
import { round2, invoiceBalanceDue } from "@/lib/money";
import { buildStages, statusLine, isActive } from "@/lib/documentStage";

export default async function DashboardPage() {
  const [
    quotationCount,
    acceptedQuotationCount,
    acceptedQuotations,
    unpaidInvoices,
    pendingDepositInvoiceReceiptCount,
    pendingReceiptInvoices,
    activeProjectCandidates,
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
    // A Project with no Quotation yet (still "Discussing") is always active -
    // only a Quotation reaching REJECTED/EXPIRED/VOIDED can kill a job, and
    // that can't have happened before one even exists.
    prisma.project.findMany({
      where: {
        OR: [
          { quotation: null },
          { quotation: { status: { notIn: ["REJECTED", "EXPIRED", "VOIDED"] } } },
        ],
      },
      include: {
        client: true,
        quotation: {
          include: {
            lineItems: true,
            deliveryOrder: { include: { invoice: { include: { receipt: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Oldest first - a job that's been sitting half-finished the longest is
  // the one most worth Araz noticing, same reasoning as Pending Receipts.
  const activeProjects = activeProjectCandidates
    .map((p) => {
      const q = p.quotation;
      if (!q) {
        return {
          id: p.id,
          client: p.client.name,
          title: p.title,
          date: p.createdAt,
          total: 0,
          progress: "Discussing - no quotation yet.",
          active: true,
        };
      }
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
              hasReceipt: q.deliveryOrder.invoice.receipt != null,
            }
          : null,
        receipt: q.deliveryOrder?.invoice?.receipt
          ? { issuedAt: q.deliveryOrder.invoice.receipt.issuedAt }
          : null,
      });
      return {
        id: p.id,
        client: p.client.name,
        title: p.title,
        date: p.createdAt,
        total: q.lineItems.reduce((sum, line) => sum + line.lineTotal.toNumber(), 0),
        progress: statusLine(stages),
        active: isActive(stages),
      };
    })
    .filter((p) => p.active);

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
    {
      label: "Unpaid Invoices",
      value: unpaidInvoices.length,
      danger: unpaidInvoices.length > 0,
    },
    {
      label: "Unpaid Total",
      value: `RM ${unpaidTotal.toFixed(2)}`,
      danger: unpaidTotal > 0,
    },
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
        Active Projects
      </h2>
      {activeProjects.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing currently in progress.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Date</th>
              <th>Progress</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {activeProjects.map((p) => (
              <tr key={p.id}>
                <td>{p.title ?? p.client}</td>
                <td className="text-ink-soft">{p.client}</td>
                <td className="text-ink-soft">{p.date.toLocaleDateString("en-MY")}</td>
                <td className="text-ink-soft">{p.progress}</td>
                <td className="num">RM {p.total.toFixed(2)}</td>
                <td className="text-right">
                  <Link href={`/projects/${p.id}`} className="link">
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
