export type BadgeTone = "pending" | "positive" | "negative";

// One tone map per document type - purely presentational (which color a
// status badge renders as), not a change to the status enums or the
// allowed-transition logic in each doc type's actions.ts.
export const quotationTone: Record<string, BadgeTone> = {
  DRAFT: "pending",
  SENT: "positive",
  ACCEPTED: "positive",
  REJECTED: "negative",
  EXPIRED: "negative",
  VOIDED: "negative",
};

export const deliveryOrderTone: Record<string, BadgeTone> = {
  DRAFT: "pending",
  DELIVERED: "positive",
  VOIDED: "negative",
};

export const invoiceTone: Record<string, BadgeTone> = {
  DRAFT: "pending",
  UNPAID: "pending",
  PAID: "positive",
  VOIDED: "negative",
};
