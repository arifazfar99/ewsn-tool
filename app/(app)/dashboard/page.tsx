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
    activeQuotationCandidates,
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
    // REJECTED/EXPIRED/VOIDED quotations can never be active regardless of
    // what's downstream, so they're excluded here rather than relying on
    // isActive() to filter every row after the fact.
    prisma.quotation.findMany({
      where: { status: { notIn: ["REJECTED", "EXPIRED", "VOIDED"] } },
      include: {
        client: true,
        lineItems: true,
        deliveryOrder: { include: { invoice: { include: { receipt: true } } } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // Oldest first - a job that's been sitting half-finished the longest is
  // the one most worth Araz noticing, same reasoning as Pending Receipts.
  const activeQuotations = activeQuotationCandidates
    .map((q) => {
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
        id: q.id,
        number: q.number,
        client: q.client.name,
        title: q.title,
        date: q.date,
        total: q.lineItems.reduce((sum, line) => sum + line.lineTotal.toNumber(), 0),
        progress: statusLine(stages),
        active: isActive(stages),
      };
    })
    .filter((q) => q.active);

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
        Active Quotations
      </h2>
      {activeQuotations.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing currently in progress.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Date</th>
              <th>Progress</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {activeQuotations.map((q) => (
              <tr key={q.id}>
                <td className="num">{q.number ?? "DRAFT"}</td>
                <td className="text-ink-soft">
                  {q.client}
                  {q.title && (
                    <span className="block text-xs text-ink-soft">{q.title}</span>
                  )}
                </td>
                <td className="text-ink-soft">{q.date.toLocaleDateString("en-MY")}</td>
                <td className="text-ink-soft">{q.progress}</td>
                <td className="num">RM {q.total.toFixed(2)}</td>
                <td className="text-right">
                  <Link href={`/quotations/${q.id}`} className="link">
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
