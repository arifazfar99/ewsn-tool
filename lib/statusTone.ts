export type StampTone = "pending" | "positive" | "negative";

// One tone map per document type - purely presentational (which color of
// ink stamp a status renders as), not a change to the status enums or the
// allowed-transition logic in each doc type's actions.ts.
export const quotationTone: Record<string, StampTone> = {
  DRAFT: "pending",
  SENT: "positive",
  ACCEPTED: "positive",
  REJECTED: "negative",
  EXPIRED: "negative",
  VOIDED: "negative",
};

export const deliveryOrderTone: Record<string, StampTone> = {
  DRAFT: "pending",
  DELIVERED: "positive",
  VOIDED: "negative",
};

export const invoiceTone: Record<string, StampTone> = {
  DRAFT: "pending",
  UNPAID: "pending",
  PAID: "positive",
  VOIDED: "negative",
};
