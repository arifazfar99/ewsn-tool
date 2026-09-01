import { round2 } from "@/lib/money";

type StageState = "done" | "active" | "negative" | "upcoming";

type Stage = {
  label: string;
  state: StageState;
  sub: string;
};

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
    depositReceived: number | null;
  } | null;
  receipt: { issuedAt: Date | null } | null;
  depositInvoice: { amount: number; receivedAt: Date | null } | null;
};

function fmt(date: Date) {
  return date.toLocaleDateString("en-MY");
}

// A stage is "done" once the next document in the chain actually exists -
// not on its own status - so e.g. a Delivery Order that's still DRAFT but
// already converted to an Invoice still reads as done here.
function buildStages(props: DocumentStageTrackerProps): Stage[] {
  const { quotation, deliveryOrder, invoice, receipt } = props;

  // VOIDED is checked before acceptedAt (unlike a plain "was it ever
  // accepted" read) since acceptedAt is never cleared once set - an
  // ACCEPTED quotation can still be VOIDED afterwards (a real allowed
  // transition), and that must show as stopped, not as permanently "done".
  const stage1: Stage =
    quotation.status === "REJECTED" ||
    quotation.status === "EXPIRED" ||
    quotation.status === "VOIDED"
      ? { label: "Quotation", state: "negative", sub: quotation.status.charAt(0) + quotation.status.slice(1).toLowerCase() }
      : quotation.acceptedAt
        ? { label: "Quotation", state: "done", sub: `Accepted ${fmt(quotation.acceptedAt)}` }
        : { label: "Quotation", state: "active", sub: quotation.status === "SENT" ? "Sent" : "Drafting" };

  const stage2: Stage = !deliveryOrder
    ? stage1.state === "done"
      ? { label: "Delivery Order", state: "active", sub: "Pending" }
      : { label: "Delivery Order", state: "upcoming", sub: "" }
    : deliveryOrder.status === "VOIDED"
      ? { label: "Delivery Order", state: "negative", sub: "Voided" }
      : deliveryOrder.hasInvoice
        ? {
            label: "Delivery Order",
            state: "done",
            sub: deliveryOrder.deliveredAt
              ? `Delivered ${fmt(deliveryOrder.deliveredAt)}`
              : "Converted to invoice",
          }
        : {
            label: "Delivery Order",
            state: "active",
            sub: deliveryOrder.status === "DELIVERED" ? "Delivered, invoice pending" : "Pending",
          };

  const stage3: Stage = !invoice
    ? { label: "Invoice", state: "upcoming", sub: "" }
    : invoice.status === "VOIDED"
      ? { label: "Invoice", state: "negative", sub: "Voided" }
      : invoice.hasReceipt
        ? {
            label: "Invoice",
            state: "done",
            sub: invoice.paidAt ? `Paid ${fmt(invoice.paidAt)}` : "Paid",
          }
        : {
            label: "Invoice",
            state: "active",
            sub:
              invoice.status === "PAID"
                ? "Paid, awaiting receipt"
                : invoice.status === "DRAFT"
                  ? "Drafting"
                  : "Unpaid",
          };

  const stage4: Stage = !receipt
    ? { label: "Receipt", state: "upcoming", sub: "" }
    : { label: "Receipt", state: "done", sub: receipt.issuedAt ? `Issued ${fmt(receipt.issuedAt)}` : "Issued" };

  return [stage1, stage2, stage3, stage4];
}

function statusLine(stages: Stage[]): string {
  const current = stages.find((s) => s.state === "active" || s.state === "negative");
  if (!current) return "Paid in full - receipt issued.";
  if (current.state === "negative") return `Quotation ${current.sub.toLowerCase()}.`;
  if (current.label === "Quotation") return current.sub === "Sent" ? "Quotation sent - awaiting decision." : "Preparing quotation.";
  if (current.label === "Delivery Order") return current.sub === "Pending" ? "Accepted - preparing delivery order." : "Goods delivered - invoice pending.";
  if (current.label === "Invoice")
    return current.sub === "Unpaid"
      ? "Invoice issued - awaiting payment."
      : current.sub === "Drafting"
        ? "Preparing invoice."
        : "Paid - receipt pending.";
  return "";
}

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
      ? round2(invoice.total - (depositAmount ?? 0))
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
