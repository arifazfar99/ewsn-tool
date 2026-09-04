import type { Prisma } from "@/generated/prisma/client";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function sumLineItems(lineItems: { lineTotal: Prisma.Decimal | number }[]): number {
  return round2(lineItems.reduce((sum, line) => sum + toNumber(line.lineTotal), 0));
}

// Single source of truth for what an Invoice actually owes - Invoice.total is
// never a stored column, so every caller (detail page, PDF, Receipt amount,
// Dashboard tiles) must derive it the same way or the numbers can silently
// disagree with each other.
export function invoiceBalanceDue(
  lineItems: { lineTotal: Prisma.Decimal | number }[],
  discountAmount?: Prisma.Decimal | number | null,
  depositReceived?: Prisma.Decimal | number | null
): number {
  return round2(sumLineItems(lineItems) - toNumber(discountAmount) - toNumber(depositReceived));
}
