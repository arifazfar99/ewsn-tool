import Link from "next/link";
import { prisma } from "@/lib/db";
import type { BadgeTone } from "@/lib/statusTone";
import { invoiceUncreditedAmountFor } from "@/lib/money";

type PendingRow = {
  type: "Deposit Invoice" | "Invoice";
  client: string;
  number: string;
  amount: number;
  dateForSort: Date;
  dateLabel: string;
  daysOutstanding: number;
  href: string;
};

const DAY_MS = 86_400_000;

const OUTSTANDING_TONE: Record<BadgeTone, string> = {
  negative: "bg-danger-soft text-danger",
  pending: "bg-surface-muted text-ink-soft",
  positive: "bg-success-soft text-success-text",
};

function outstandingTone(days: number): BadgeTone {
  return days >= 14 ? "negative" : "pending";
}

const TH = "border-b border-border bg-surface-muted px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-soft";

export default async function ReceiptsPage() {
  const now = new Date().getTime();

  const [pendingDepositInvoices, pendingInvoices, receipts] =
    await Promise.all([
      prisma.depositInvoice.findMany({
        where: { receivedAt: { not: null }, receipt: null },
        include: { sourceQuotation: { include: { client: true } } },
        orderBy: { receivedAt: "asc" },
      }),
      prisma.invoice.findMany({
        where: { issuedAt: { not: null }, status: { not: "VOIDED" } },
        include: {
          client: true,
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
        orderBy: { depositReceivedAt: "asc" },
      }),
      prisma.receipt.findMany({
        include: {
          sourceDepositInvoice: {
            include: { sourceQuotation: { include: { client: true } } },
          },
          sourceInvoice: { include: { client: true } },
        },
        orderBy: { issuedAt: "desc" },
      }),
    ]);

  const pendingRows: PendingRow[] = [
    ...pendingDepositInvoices.map((di) => {
      const dateForSort = di.receivedAt!;
      return {
        type: "Deposit Invoice" as const,
        // sourceQuotationId can go null (onDelete: SetNull) - shown as "—"
        // rather than dropped, so a receipt still owed doesn't silently
        // disappear from this list just because its quotation was removed.
        client: di.sourceQuotation?.client.name ?? "—",
        number: di.number ?? "DRAFT",
        amount: di.amount.toNumber(),
        dateForSort,
        dateLabel: dateForSort.toLocaleDateString("en-MY"),
        daysOutstanding: Math.floor((now - dateForSort.getTime()) / DAY_MS),
        href: `/projects/${di.sourceQuotation?.projectId}`,
      };
    }),
    // depositReceived is already credited to its own DepositInvoice/Receipt
    // pair (or hand-typed with no DepositInvoice at all) - this mirrors the
    // exact amount calc issueReceiptForInvoice uses so a fully-covered
    // invoice never shows a stale positive amount here. This is the
    // uncredited delta (received minus already-receipted), not the overall
    // balance still owed - an UNPAID invoice with a partial payment already
    // receipted correctly drops off this list once that payment is credited,
    // even though the invoice itself still owes more.
    ...pendingInvoices
      .map((inv) => {
        const amount = invoiceUncreditedAmountFor(
          inv,
          inv.sourceDeliveryOrder?.sourceQuotation?.depositInvoice?.receipt?.amount
        );
        // depositReceivedAt is the most meaningful "when did this money
        // actually show up" signal for a partially-paid, still-UNPAID
        // invoice (which has no paidAt yet); falls back to paidAt, then
        // updatedAt as a last resort for a pre-migration row.
        const dateForSort = inv.depositReceivedAt ?? inv.paidAt ?? inv.updatedAt;
        return {
          type: "Invoice" as const,
          client: inv.client.name,
          number: inv.number ?? "DRAFT",
          amount,
          dateForSort,
          dateLabel: dateForSort.toLocaleDateString("en-MY"),
          daysOutstanding: Math.floor((now - dateForSort.getTime()) / DAY_MS),
          href: `/invoices/${inv.id}`,
        };
      })
      // A hand-typed depositReceived can already cover the full total (no
      // formal DepositInvoice/Receipt pair required for that money) -
      // issueReceiptForInvoice itself blocks issuance once amount <= 0, so
      // there's nothing actionable to surface here either.
      .filter((row) => row.amount > 0),
  ].sort((a, b) => a.dateForSort.getTime() - b.dateForSort.getTime());

  const issuedRows = receipts.map((r) => {
    // Branch on which source FK is actually set (the DB CHECK constraint
    // guarantees exactly one), not on whether the nested sourceQuotation
    // happens to be present too - that can independently be null (SetNull
    // on delete) without meaning the receipt itself lacks a real source.
    if (r.sourceDepositInvoice) {
      return {
        id: r.id,
        number: r.number ?? "DRAFT",
        client: r.sourceDepositInvoice.sourceQuotation?.client.name ?? "—",
        date: r.date,
        amount: r.amount.toNumber(),
        source: `Deposit Invoice ${r.sourceDepositInvoice.number ?? "DRAFT"}`,
      };
    }
    if (r.sourceInvoice) {
      return {
        id: r.id,
        number: r.number ?? "DRAFT",
        client: r.sourceInvoice.client.name,
        date: r.date,
        amount: r.amount.toNumber(),
        source: `Invoice ${r.sourceInvoice.number ?? "DRAFT"}`,
      };
    }
    // Defensive only - the DB CHECK constraint on Receipt guarantees exactly
    // one source is always set.
    return {
      id: r.id,
      number: r.number ?? "DRAFT",
      client: "—",
      date: r.date,
      amount: r.amount.toNumber(),
      source: "—",
    };
  });

  return (
    <div>
      <h1 className="page-title mb-5">Receipts</h1>

      <div className="mb-6 overflow-hidden rounded-md border border-border bg-surface">
        <div
          className={`border-b border-border px-4 py-3.5 ${
            pendingRows.length > 0 ? "bg-danger-soft" : ""
          }`}
        >
          <h2
            className={`text-sm font-bold ${
              pendingRows.length > 0 ? "text-danger" : "text-ink"
            }`}
          >
            Pending Receipts
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Paid items with no receipt issued yet, oldest first
          </p>
        </div>
        {pendingRows.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">
            No pending receipts — you&apos;re all caught up.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Type", "Client", "Number", "Date"].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH}>Outstanding</th>
                  <th className="border-b border-border bg-surface-muted px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((row) => (
                  <tr
                    key={row.href + row.number}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted/60"
                  >
                    <td className="px-4 py-2.5 text-ink-soft">{row.type}</td>
                    <td className="px-4 py-2.5">{row.client}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{row.number}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{row.dateLabel}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      RM {row.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${OUTSTANDING_TONE[outstandingTone(row.daysOutstanding)]}`}
                      >
                        {row.daysOutstanding}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={row.href}
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

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-sm font-bold text-ink">Issued Receipts</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Confirmed payments, most recent first
          </p>
        </div>
        {issuedRows.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">No receipts issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Number", "Client", "Date"].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH}>Source</th>
                  <th className="border-b border-border bg-surface-muted px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {issuedRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted/60"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums">{r.number}</td>
                    <td className="px-4 py-2.5">{r.client}</td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {r.date.toLocaleDateString("en-MY")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      RM {r.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.source}</td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`/api/documents/receipt/${r.id}/pdf`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary-soft"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
