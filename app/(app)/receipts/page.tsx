import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import type { BadgeTone } from "@/lib/statusTone";
import { round2 } from "@/lib/money";

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

function outstandingTone(days: number): BadgeTone {
  return days >= 14 ? "negative" : "pending";
}

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
        where: { status: "PAID", receipt: null },
        include: { client: true, lineItems: true },
        orderBy: { paidAt: "asc" },
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
        href: `/deposit-invoices/${di.id}/preview`,
      };
    }),
    // depositReceived is already credited to its own DepositInvoice/Receipt
    // pair (or hand-typed with no DepositInvoice at all) - this mirrors the
    // exact amount calc issueReceiptForInvoice uses so a fully-covered
    // invoice never shows a stale positive amount here.
    ...pendingInvoices
      .map((inv) => {
        const total = inv.lineItems.reduce(
          (sum, line) => sum + line.lineTotal.toNumber(),
          0
        );
        const amount = round2(total - (inv.depositReceived?.toNumber() ?? 0));
        // paidAt is set on every transition into PAID (see setInvoiceStatus)
        // and cleared on any transition away from it, so it's always present
        // for a row this query can return; updatedAt is kept only as a
        // defensive fallback for a pre-migration row the backfill missed.
        const dateForSort = inv.paidAt ?? inv.updatedAt;
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
      <h1 className="page-title mb-6">Receipts</h1>

      <h2 className="mb-1 text-base font-semibold text-ink">
        Pending Receipts
      </h2>
      <p className="mb-3 text-sm text-ink-soft">
        Paid items with no receipt issued yet, oldest first.
      </p>
      {pendingRows.length === 0 ? (
        <p className="mb-8 text-sm text-ink-soft">
          No pending receipts — you&apos;re all caught up.
        </p>
      ) : (
        <div className="mb-8 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Client</th>
                <th>Number</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Days Outstanding</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((row) => (
                <tr key={row.href}>
                  <td className="text-ink-soft">{row.type}</td>
                  <td>{row.client}</td>
                  <td className="num">{row.number}</td>
                  <td className="num">RM {row.amount.toFixed(2)}</td>
                  <td>{row.dateLabel}</td>
                  <td>
                    <StatusBadge
                      label={`${row.daysOutstanding}d`}
                      tone={outstandingTone(row.daysOutstanding)}
                    />
                  </td>
                  <td className="text-right">
                    <Link href={row.href} className="link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold text-ink">
        Issued Receipts
      </h2>
      {issuedRows.length === 0 ? (
        <p className="text-sm text-ink-soft">No receipts issued yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issuedRows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.number}</td>
                  <td>{r.client}</td>
                  <td>{r.date.toLocaleDateString("en-MY")}</td>
                  <td className="num">RM {r.amount.toFixed(2)}</td>
                  <td className="text-ink-soft">{r.source}</td>
                  <td className="text-right">
                    <Link href={`/receipts/${r.id}/preview`} className="link">
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
