"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { nextDocumentNumber } from "@/lib/numbering";
import { invoiceBalanceDue, invoiceUncreditedAmount, round2 } from "@/lib/money";

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
    include: {
      receipt: true,
      sourceQuotation: { select: { projectId: true, number: true, title: true } },
    },
  });
  if (!depositInvoice) {
    throw new Error("Deposit invoice not found");
  }
  const projectId = depositInvoice.sourceQuotation?.projectId;
  if (!depositInvoice.receivedAt || depositInvoice.receipt) {
    redirect(
      `/projects/${projectId}?error=` +
        encodeURIComponent(
          "This deposit invoice must be marked received and not already have a receipt."
        )
    );
  }

  // Snapshotted at issuance, same reasoning as issueReceiptForInvoice below -
  // a Deposit Invoice is always one lump sum (this receipt is always its
  // only one), but stored rather than computed live for consistency with
  // every other Receipt row.
  const quotation = depositInvoice.sourceQuotation;
  const description = `Deposit received for Quotation ${quotation?.number ?? "—"}${
    quotation?.title ? ` — ${quotation.title}` : ""
  } (Deposit Invoice ${depositInvoice.number ?? "DRAFT"})`;

  try {
    await prisma.$transaction(async (tx) => {
      const { number, year } = await nextDocumentNumber(tx, "RECEIPT");
      return tx.receipt.create({
        data: {
          number,
          year,
          date: depositInvoice.receivedAt!,
          amount: depositInvoice.amount,
          description,
          sourceDepositInvoiceId: depositInvoiceId,
          issuedAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/projects/${projectId}?error=` +
          encodeURIComponent("A receipt already exists for this deposit invoice.")
      );
    }
    throw e;
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(withSuccess(`/projects/${projectId}`, "Receipt issued"));
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
    include: {
      receipts: true,
      lineItems: true,
      sourceDeliveryOrder: { select: { sourceQuotation: { select: { projectId: true } } } },
    },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  const projectId = invoice.sourceDeliveryOrder?.sourceQuotation?.projectId;
  if (!invoice.issuedAt || invoice.status === "VOIDED") {
    redirect(
      `/projects/${projectId}?error=` +
        encodeURIComponent(
          "This invoice must be issued and not voided before a receipt can be issued."
        )
    );
  }

  // Delta since the last receipt, not the full remaining balance - a
  // customer who's only paid part of the invoice can now get a receipt for
  // exactly what they paid, without the invoice needing to be fully PAID
  // first. See lib/money.ts's invoiceUncreditedAmount.
  const amount = invoiceUncreditedAmount(
    invoice.depositReceived,
    invoice.receipts.map((r) => r.amount)
  );
  if (amount <= 0) {
    redirect(
      `/projects/${projectId}?error=` +
        encodeURIComponent(
          "Nothing new to receipt - the recorded deposit is already fully credited to a previous receipt."
        )
    );
  }

  // Description/notes snapshotted here, at issuance, using the invoice's
  // state right now - never recomputed later. Otherwise re-downloading an
  // older receipt after a newer one exists (or after depositReceived is
  // topped up again) would retroactively change what it says - e.g. a
  // genuinely partial first payment relabeled "Final" once a second receipt
  // is issued, purely because the PDF route looked at today's data instead
  // of what was true when this specific receipt was created.
  const isFirstReceipt = invoice.receipts.length === 0;
  const balanceRemaining = invoiceBalanceDue(
    invoice.lineItems,
    invoice.discountAmount,
    invoice.depositReceived
  );
  const description =
    isFirstReceipt && balanceRemaining <= 0
      ? `Payment received for Invoice ${invoice.number ?? "DRAFT"}`
      : balanceRemaining > 0
        ? `Partial payment received for Invoice ${invoice.number ?? "DRAFT"}`
        : `Final payment received for Invoice ${invoice.number ?? "DRAFT"}`;
  const invoiceTotal = round2(balanceRemaining + (invoice.depositReceived?.toNumber() ?? 0));
  const receivedToDate = invoice.depositReceived?.toNumber() ?? 0;
  const notes = `Total invoice: RM ${invoiceTotal.toFixed(2)} — Received to date: RM ${receivedToDate.toFixed(2)} — Balance remaining: RM ${balanceRemaining.toFixed(2)}`;

  try {
    await prisma.$transaction(async (tx) => {
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
          description,
          notes,
          sourceInvoiceId: invoiceId,
          issuedAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/projects/${projectId}?error=` +
          encodeURIComponent("Could not issue the receipt - a numbering conflict occurred, please retry.")
      );
    }
    throw e;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/projects/${projectId}`);
  redirect(withSuccess(`/projects/${projectId}`, "Receipt issued"));
}
