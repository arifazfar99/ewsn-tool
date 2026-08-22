"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { nextDocumentNumber } from "@/lib/numbering";
import { round2 } from "@/lib/money";

function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

// Creates and issues a Receipt in one step, same reasoning as
// createDepositInvoice: a Receipt is a single amount confirming money
// already received, nothing to iteratively edit.
export async function issueReceiptForDepositInvoice(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const depositInvoiceId = formData.get("depositInvoiceId")?.toString();
  if (!depositInvoiceId) {
    throw new Error("Missing deposit invoice id");
  }

  const depositInvoice = await prisma.depositInvoice.findUnique({
    where: { id: depositInvoiceId },
    include: { receipt: true },
  });
  if (!depositInvoice) {
    throw new Error("Deposit invoice not found");
  }
  if (!depositInvoice.receivedAt || depositInvoice.receipt) {
    redirect(
      `/deposit-invoices/${depositInvoiceId}/preview?error=` +
        encodeURIComponent(
          "This deposit invoice must be marked received and not already have a receipt."
        )
    );
  }

  let receipt;
  try {
    receipt = await prisma.$transaction(async (tx) => {
      const { number, year } = await nextDocumentNumber(tx, "RECEIPT");
      return tx.receipt.create({
        data: {
          number,
          year,
          date: depositInvoice.receivedAt!,
          amount: depositInvoice.amount,
          sourceDepositInvoiceId: depositInvoiceId,
          issuedAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/deposit-invoices/${depositInvoiceId}/preview?error=` +
          encodeURIComponent("A receipt already exists for this deposit invoice.")
      );
    }
    throw e;
  }

  revalidatePath(`/deposit-invoices/${depositInvoiceId}/preview`);
  redirect(withSuccess(`/receipts/${receipt.id}/preview`, "Receipt issued"));
}

// Same one-step create+issue pattern, amount recomputed server-side from the
// invoice's own line items minus whatever deposit was already credited (and
// therefore already receipted separately, whether via a DepositInvoice or a
// hand-typed depositReceived with no DepositInvoice at all) - never trusts a
// stored total.
export async function issueReceiptForInvoice(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const invoiceId = formData.get("invoiceId")?.toString();
  if (!invoiceId) {
    throw new Error("Missing invoice id");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true, receipt: true },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  if (invoice.status !== "PAID" || invoice.receipt) {
    redirect(
      `/invoices/${invoiceId}?error=` +
        encodeURIComponent(
          "This invoice must be marked Paid and not already have a receipt."
        )
    );
  }

  const total = invoice.lineItems.reduce(
    (sum, line) => sum + line.lineTotal.toNumber(),
    0
  );
  const amount = round2(total - (invoice.depositReceived?.toNumber() ?? 0));
  if (amount <= 0) {
    redirect(
      `/invoices/${invoiceId}?error=` +
        encodeURIComponent(
          "Nothing left to receipt - the recorded deposit already covers the full total."
        )
    );
  }

  let receipt;
  try {
    receipt = await prisma.$transaction(async (tx) => {
      const { number, year } = await nextDocumentNumber(tx, "RECEIPT");
      return tx.receipt.create({
        data: {
          number,
          year,
          // Invoice has no dedicated "paid at" timestamp to draw from (unlike
          // DepositInvoice.receivedAt above), so this is always "now" -
          // accepted gap: if Paid is marked days before the receipt is
          // actually issued, the receipt date won't match the real payment
          // date. Would need a new Invoice field to fix properly.
          date: new Date(),
          amount,
          sourceInvoiceId: invoiceId,
          issuedAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/invoices/${invoiceId}?error=` +
          encodeURIComponent("A receipt already exists for this invoice.")
      );
    }
    throw e;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  redirect(withSuccess(`/receipts/${receipt.id}/preview`, "Receipt issued"));
}
