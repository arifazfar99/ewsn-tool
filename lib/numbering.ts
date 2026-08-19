import type { Prisma } from "@/generated/prisma/client";
import { DocType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const PREFIX: Record<DocType, string> = {
  QUOTATION: "QT",
  DELIVERY_ORDER: "DO",
  INVOICE: "INV",
  DEPOSIT_INVOICE: "DEP",
};

// Matches the trailing "-YYYY-NNNN" of a document number regardless of the
// prefix text in front, so a manually-typed number still syncs the counter
// even if its prefix doesn't exactly match PREFIX[docType].
const NUMBER_SUFFIX_PATTERN = /-(\d{4})-(\d+)$/;

// Read-only peek at what nextDocumentNumber() would assign next, without
// reserving it. Used to pre-fill a suggested value in a draft form.
export async function previewNextDocumentNumber(
  docType: DocType
): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await prisma.documentCounter.findUnique({
    where: { docType_year: { docType, year } },
  });
  const nextNumber = (counter?.lastNumber ?? 0) + 1;
  return `${PREFIX[docType]}-${year}-${String(nextNumber).padStart(4, "0")}`;
}

// Extracts the year out of a manually-typed number (e.g. "QT-2026-0019" ->
// 2026), for stamping the same year onto the document's own `year` column.
// Returns null if the number is blank or doesn't match the expected shape.
export function parseYearFromNumber(
  number: string | null | undefined
): number | null {
  if (!number) return null;
  const match = number.match(NUMBER_SUFFIX_PATTERN);
  return match ? Number.parseInt(match[1], 10) : null;
}

// Advances DocumentCounter to match a manually-entered number, so future
// auto-suggestions continue from it instead of colliding with it. No-op if
// the number doesn't end in "-YYYY-NNNN", and never moves the counter
// backwards.
export async function syncCounterFromNumber(
  tx: Prisma.TransactionClient,
  docType: DocType,
  number: string | null | undefined
): Promise<void> {
  if (!number) return;
  const match = number.match(NUMBER_SUFFIX_PATTERN);
  if (!match) return;

  const year = Number.parseInt(match[1], 10);
  const seq = Number.parseInt(match[2], 10);

  const existing = await tx.documentCounter.findUnique({
    where: { docType_year: { docType, year } },
  });
  if (existing && existing.lastNumber >= seq) return;

  await tx.documentCounter.upsert({
    where: { docType_year: { docType, year } },
    update: { lastNumber: seq },
    create: { docType, year, lastNumber: seq },
  });
}

// Atomically assigns the next sequential number for a doc type + calendar
// year. Must be called inside the same transaction that issues the document.
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  docType: DocType
): Promise<{ number: string; year: number }> {
  const year = new Date().getFullYear();
  const counter = await tx.documentCounter.upsert({
    where: { docType_year: { docType, year } },
    update: { lastNumber: { increment: 1 } },
    create: { docType, year, lastNumber: 1 },
  });
  return {
    number: `${PREFIX[docType]}-${year}-${String(counter.lastNumber).padStart(4, "0")}`,
    year,
  };
}
