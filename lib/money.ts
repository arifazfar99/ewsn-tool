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

// Amount to credit on a NEW Receipt for an Invoice. depositReceived is
// already "cumulative amount received to date" (see setInvoiceDeposit) -
// not additive - so this is the delta since the last receipt: the running
// total minus the sum of every Receipt already issued against this invoice.
// Never crashes on null/zero input - callers treat <= 0 as "nothing new".
export function invoiceUncreditedAmount(
  depositReceived: Prisma.Decimal | number | null | undefined,
  existingReceiptAmounts: (Prisma.Decimal | number)[]
): number {
  const receivedSoFar = toNumber(depositReceived);
  const alreadyReceipted = round2(
    existingReceiptAmounts.map(toNumber).reduce((sum, n) => sum + n, 0)
  );
  return round2(receivedSoFar - alreadyReceipted);
}

// The "existing receipt amounts" to feed invoiceUncreditedAmount for an
// Invoice - its own Receipts, PLUS (if present) the amount already
// receipted through the sibling Deposit Invoice. That money gets carried
// into Invoice.depositReceived at DO->Invoice conversion time (see
// convertDeliveryOrderToInvoice) but was receipted through a completely
// separate document/Receipt (sourceDepositInvoiceId, not sourceInvoiceId) -
// without this, invoiceUncreditedAmount would re-offer to receipt money
// that already has a receipt, from a different document.
export function invoiceReceiptedAmounts(
  invoiceReceipts: { amount: Prisma.Decimal | number }[],
  depositInvoiceReceiptAmount?: Prisma.Decimal | number | null
): (Prisma.Decimal | number)[] {
  const amounts = invoiceReceipts.map((r) => r.amount);
  if (depositInvoiceReceiptAmount != null) amounts.push(depositInvoiceReceiptAmount);
  return amounts;
}
