import { round2 } from "@/lib/money";
import { buildStages, statusLine } from "@/lib/documentStage";

export type DocumentStageTrackerProps = {
  quotation: {
    status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "VOIDED";
    acceptedAt: Date | null;
    updatedAt: Date;
  };
  deliveryOrder: {
    status: "DRAFT" | "DELIVERED" | "VOIDED";
    deliveredAt: Date | null;
    hasInvoice: boolean;
  } | null;
  invoice: {
    status: "DRAFT" | "UNPAID" | "PAID" | "VOIDED";
    paidAt: Date | null;
    hasReceipt: boolean;
    total: number;
    discountAmount: number | null;
    depositReceived: number | null;
  } | null;
  receipt: { issuedAt: Date | null } | null;
  depositInvoice: { amount: number; receivedAt: Date | null } | null;
};

export function DocumentStageTracker(props: DocumentStageTrackerProps) {
  const stages = buildStages(props);
  const { invoice, depositInvoice } = props;

  const depositAmount =
    invoice?.depositReceived != null
      ? invoice.depositReceived
      : depositInvoice?.receivedAt != null
        ? depositInvoice.amount
        : null;

  // Only shown while the Invoice is genuinely UNPAID - a DRAFT invoice
  // isn't issued yet, and PAID/VOIDED both mean nothing is currently owed
  // (PAID is treated as fully settled the moment it's set, independent of
  // whether a Receipt has been issued yet), so showing a leftover balance
  // in any of those states would contradict the status line right above it.
  // Nets against the same resolved `depositAmount` shown in the chip below
  // (not invoice.depositReceived alone) so the two figures never disagree.
  const balanceDue =
    invoice && invoice.status === "UNPAID"
      ? round2(invoice.total - (invoice.discountAmount ?? 0) - (depositAmount ?? 0))
      : null;

  return (
    <div className="mb-6 rounded-md border border-border bg-surface-muted p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">{statusLine(stages)}</p>
          {balanceDue !== null && (
            <p className="mt-0.5 font-mono text-[13px] text-ink-soft">
              Balance due <span className="font-semibold text-ink">RM {balanceDue.toFixed(2)}</span>
            </p>
          )}
        </div>
        <span
          className={`badge ${depositAmount !== null ? "badge-positive" : "badge-pending"}`}
        >
          {depositAmount !== null ? `RM ${depositAmount.toFixed(2)} received` : "No deposit yet"}
        </span>
      </div>

      <div className="flex items-start">
        {stages.map((stage, i) => {
          const prevDone = i > 0 && stages[i - 1].state === "done";
          return (
            <div key={stage.label} className="relative flex flex-1 flex-col items-center gap-2">
              {i > 0 && (
                <div
                  className={`absolute top-[15px] right-1/2 h-0.5 w-full ${
                    prevDone ? "bg-success" : "bg-border"
                  }`}
                />
              )}
              <div
                className={`z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 font-mono text-[13px] font-semibold ${
                  stage.state === "done"
                    ? "border-success bg-success text-white"
                    : stage.state === "active"
                      ? "border-primary bg-primary-soft text-primary"
                      : stage.state === "negative"
                        ? "border-danger bg-danger-soft text-danger"
                        : "border-border bg-surface text-ink-soft"
                }`}
              >
                {stage.state === "done" ? "✓" : stage.state === "negative" ? "✕" : i + 1}
              </div>
              <p
                className={`text-center text-[11.5px] font-semibold uppercase tracking-wide ${
                  stage.state === "upcoming" ? "text-ink-soft" : "text-ink"
                }`}
              >
                {stage.label}
              </p>
              <p className="min-h-[14px] text-center text-[11px] text-ink-soft">{stage.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
