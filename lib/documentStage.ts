export type StageState = "done" | "active" | "negative" | "upcoming";

export type Stage = {
  label: string;
  state: StageState;
  sub: string;
};

export type StageInput = {
  quotation: {
    status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "VOIDED";
    acceptedAt: Date | null;
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
  } | null;
  receipt: { issuedAt: Date | null } | null;
};

function fmt(date: Date) {
  return date.toLocaleDateString("en-MY");
}

// A stage is "done" once the next document in the chain actually exists -
// not on its own status - so e.g. a Delivery Order that's still DRAFT but
// already converted to an Invoice still reads as done here.
export function buildStages(props: StageInput): Stage[] {
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

// A job is "active" once it has a real next step waiting on someone, and
// hasn't gone dead anywhere along the chain (a voided Delivery Order or
// Invoice kills the job even if the Quotation itself is still ACCEPTED).
export function isActive(stages: Stage[]): boolean {
  return (
    stages.some((s) => s.state === "active") &&
    !stages.some((s) => s.state === "negative")
  );
}

export function statusLine(stages: Stage[]): string {
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
