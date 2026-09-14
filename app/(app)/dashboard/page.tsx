import Link from "next/link";
import { prisma } from "@/lib/db";
import { round2, invoiceBalanceDue, invoiceUncreditedAmountFor } from "@/lib/money";
import { buildStages, statusLine, isActive } from "@/lib/documentStage";

const PILL_TONE: Record<"discussing" | "progress" | "danger", string> = {
  discussing: "bg-surface-muted text-ink-soft",
  progress: "bg-primary-soft text-primary",
  danger: "bg-danger-soft text-danger",
};

function money(n: number) {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DashboardPage() {
  const [
    quotationCount,
    acceptedQuotationCount,
    acceptedQuotations,
    unpaidInvoices,
    pendingDepositInvoiceReceipts,
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
    prisma.depositInvoice.findMany({
      where: { receivedAt: { not: null }, receipt: null },
      select: { sourceQuotation: { select: { deliveryOrder: { select: { invoice: { select: { id: true } } } } } } },
    }),
    prisma.invoice.findMany({
      where: { issuedAt: { not: null }, status: { not: "VOIDED" } },
      include: {
        receipts: true,
        // Needed by invoiceUncreditedAmountFor to reconstruct pre-2026-09-14
        // receipts' implied deposit-at-the-time - not otherwise displayed here.
        lineItems: true,
        sourceDeliveryOrder: {
          select: {
            sourceQuotation: {
              select: { depositInvoice: { select: { receipt: { select: { amount: true } } } } },
            },
          },
        },
      },
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
            depositInvoice: { select: { receipt: { select: { amount: true } } } },
            deliveryOrder: {
              include: { invoice: { include: { receipts: true, lineItems: true } } },
            },
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
          total: 0,
          progress: "Discussing - no quotation yet.",
          tone: "discussing" as const,
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
            }
          : null,
        receipt:
          q.deliveryOrder?.invoice && q.deliveryOrder.invoice.receipts.length > 0
            ? {
                count: q.deliveryOrder.invoice.receipts.length,
                latestIssuedAt: q.deliveryOrder.invoice.receipts.at(-1)?.issuedAt ?? null,
                remaining: invoiceUncreditedAmountFor(
                  q.deliveryOrder.invoice,
                  q.depositInvoice?.receipt?.amount
                ),
              }
            : null,
      });
      return {
        id: p.id,
        client: p.client.name,
        title: p.title,
        total: q.lineItems.reduce((sum, line) => sum + line.lineTotal.toNumber(), 0),
        progress: statusLine(stages),
        tone:
          q.deliveryOrder?.invoice?.status === "UNPAID"
            ? ("danger" as const)
            : ("progress" as const),
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

  // Counts invoices with money received but not yet receipted - not the
  // same thing as an unpaid balance (invoiceBalanceDue). An invoice can be
  // fully receipted for everything paid so far while still owing more, or
  // still UNPAID with a partial payment that's already been receipted.
  const pendingInvoiceReceiptCount = pendingReceiptInvoices.filter(
    (inv) =>
      invoiceUncreditedAmountFor(
        inv,
        inv.sourceDeliveryOrder?.sourceQuotation?.depositInvoice?.receipt?.amount
      ) > 0
  ).length;

  // Excludes a deposit invoice whose money has already been carried into an
  // Invoice - that pending action is now counted via pendingInvoiceReceiptCount
  // instead (the Invoice's own Issue Receipt), not this one, since only one of
  // the two buttons is ever offered for the same payment (see the Project hub).
  const pendingDepositInvoiceReceiptCount = pendingDepositInvoiceReceipts.filter(
    (di) => di.sourceQuotation?.deliveryOrder?.invoice == null
  ).length;

  const pendingReceiptCount =
    pendingDepositInvoiceReceiptCount + pendingInvoiceReceiptCount;

  const pipelineStats = [
    { label: "Quotations", value: quotationCount.toString() },
    { label: "Accepted Quotations", value: acceptedQuotationCount.toString() },
    { label: "Total Sales", value: money(totalSales), tone: "ok" as const },
    {
      label: "Net Sales",
      value: money(netSales),
      tone: netSales < 0 ? ("attention" as const) : ("ok" as const),
    },
  ];

  const attentionStats = [
    {
      label: "Unpaid Invoices",
      value: unpaidInvoices.length.toString(),
      tone: unpaidInvoices.length > 0 ? ("attention" as const) : undefined,
    },
    {
      label: "Unpaid Total",
      value: money(unpaidTotal),
      tone: unpaidTotal > 0 ? ("attention" as const) : undefined,
    },
    {
      label: "Pending Receipts",
      value: pendingReceiptCount.toString(),
      tone: pendingReceiptCount > 0 ? ("attention" as const) : undefined,
    },
    { label: "Total Costs", value: money(totalCosts) },
  ];

  const today = new Date().toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{today}</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <span aria-hidden="true">+</span> New Project
        </Link>
      </div>

      <div className="space-y-2.5">
        <span className="eyebrow">Pipeline</span>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {pipelineStats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <span className="eyebrow">Needs Attention</span>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {attentionStats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Active Projects</h2>
          <span className="text-xs text-ink-soft">{activeProjects.length} in progress</span>
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing currently in progress.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeProjects.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3.5 rounded-md border border-border bg-surface p-3.5"
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
                  {p.client.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {p.title ?? p.client}
                  </p>
                  <p className="truncate text-xs text-ink-soft">{p.client}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current ${PILL_TONE[p.tone]}`}
                >
                  {p.progress}
                </span>
                <span className="shrink-0 min-w-[88px] text-right font-mono text-[13.5px] font-semibold text-ink">
                  {money(p.total)}
                </span>
                <Link
                  href={`/projects/${p.id}`}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary-soft"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "attention" | "ok";
}) {
  const isAttention = tone === "attention";
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border p-4 ${
        isAttention ? "border-danger/25 bg-danger-soft" : "border-border bg-surface"
      }`}
    >
      <p className={`text-[11.5px] font-semibold ${isAttention ? "text-danger" : "text-ink-soft"}`}>
        {label}
      </p>
      <p
        className={`font-mono text-xl font-semibold ${
          isAttention ? "text-danger" : tone === "ok" ? "text-success" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
