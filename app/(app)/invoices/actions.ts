"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DeliveryOrderStatus, InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { round2 } from "@/lib/money";
import {
  nextDocumentNumber,
  parseYearFromNumber,
  syncCounterFromNumber,
} from "@/lib/numbering";

// itemId is required: InvoiceLineItem.itemId is a non-null FK to Item.
const lineItemSchema = z.object({
  itemId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const invoiceSchema = z.object({
  number: z.string().trim().optional(),
  title: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  bankDetailsText: z.string().trim().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});

const depositSchema = z.object({
  depositReceived: z.coerce.number().nonnegative().optional(),
  depositReceivedAt: z.string().trim().optional(),
});

function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

function parseInvoiceForm(formData: FormData) {
  const rawLineItems = formData.get("lineItems")?.toString() ?? "[]";
  let lineItemsJson: unknown = [];
  try {
    lineItemsJson = JSON.parse(rawLineItems);
  } catch {
    // leave as empty array, zod min(1) will reject below
  }

  return invoiceSchema.safeParse({
    number: formData.get("number")?.toString() || undefined,
    title: formData.get("title")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
    bankDetailsText: formData.get("bankDetailsText")?.toString() || undefined,
    lineItems: lineItemsJson,
  });
}

// Converts an issued, non-voided DeliveryOrder into a DRAFT Invoice, copying
// its client and line items. One Invoice per DeliveryOrder —
// sourceDeliveryOrderId is @unique, so a second conversion attempt fails even
// if this app-level check is bypassed. bankDetailsText is snapshotted from
// BusinessProfile now (conversion time), same as other pre-issue-editable
// fields — not deferred to issuance.
export async function convertDeliveryOrderToInvoice(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const deliveryOrderId = formData.get("deliveryOrderId")?.toString();
  if (!deliveryOrderId) {
    throw new Error("Missing delivery order id");
  }

  const deliveryOrder = await prisma.deliveryOrder.findUnique({
    where: { id: deliveryOrderId },
    include: { lineItems: true, invoice: true },
  });
  if (!deliveryOrder) {
    throw new Error("Delivery order not found");
  }

  if (
    !deliveryOrder.issuedAt ||
    deliveryOrder.status === DeliveryOrderStatus.VOIDED ||
    deliveryOrder.invoice
  ) {
    redirect(
      `/delivery-orders/${deliveryOrderId}?error=` +
        encodeURIComponent(
          "Delivery order must be issued, not voided, and not already invoiced."
        )
    );
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { id: "singleton" },
  });

  const invoice = await prisma.$transaction(async (tx) => {
    return tx.invoice.create({
      data: {
        date: new Date(),
        clientId: deliveryOrder.clientId,
        title: deliveryOrder.title,
        language: deliveryOrder.language,
        notes: deliveryOrder.notes,
        sourceDeliveryOrderId: deliveryOrder.id,
        bankDetailsText: profile?.bankDetailsText ?? "",
        lineItems: {
          create: deliveryOrder.lineItems.map((line) => ({
            itemId: line.itemId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            sortOrder: line.sortOrder,
          })),
        },
      },
    });
  });

  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${deliveryOrderId}`);
  revalidatePath("/invoices");
  redirect(withSuccess(`/invoices/${invoice.id}`, "Invoice created"));
}

export async function saveInvoice(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing invoice id");
  }

  const parsed = parseInvoiceForm(formData);
  if (!parsed.success) {
    redirect(
      `/invoices/${id}?error=` +
        encodeURIComponent("At least one valid line item is required.")
    );
  }

  const { number, title, notes, bankDetailsText, lineItems } = parsed.data;
  const preparedLines = lineItems.map((line, i) => ({
    itemId: line.itemId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: round2(line.quantity * line.unitPrice),
    sortOrder: i,
  }));
  const year = parseYearFromNumber(number);

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { issuedAt: true },
  });
  if (!existing) {
    throw new Error("Invoice not found");
  }
  if (existing.issuedAt) {
    redirect(
      `/invoices/${id}?error=` +
        encodeURIComponent(
          "This invoice is already issued and can no longer be edited."
        )
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          number: number || null,
          year,
          title: title || null,
          notes: notes ?? null,
          bankDetailsText: bankDetailsText ?? "",
          lineItems: { create: preparedLines },
        },
      });
      await syncCounterFromNumber(tx, "INVOICE", number);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/invoices/${id}?error=` +
          encodeURIComponent("That invoice number is already in use.")
      );
    }
    throw e;
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(withSuccess(`/invoices/${id}`, "Invoice saved"));
}

// Issuing assigns the number/locks content, and — unlike DeliveryOrder —
// also moves status out of DRAFT into UNPAID: an issued invoice has a real
// "awaiting payment" state to enter.
export async function issueInvoice(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing invoice id");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.issuedAt) {
    // Already issued: nothing to do, re-downloading uses the stored data.
    redirect(`/invoices/${id}/preview`);
  }

  if (invoice.lineItems.length === 0) {
    redirect(
      `/invoices/${id}?error=` +
        encodeURIComponent("Add at least one line item before generating a PDF.")
    );
  }

  await prisma.$transaction(async (tx) => {
    // A number typed in on the draft (already synced to the counter via
    // syncCounterFromNumber in saveInvoice) is kept as-is; only fall back to
    // auto-generating one if the draft was left blank.
    const { number, year } = invoice.number
      ? { number: invoice.number, year: invoice.year ?? new Date().getFullYear() }
      : await nextDocumentNumber(tx, "INVOICE");
    await tx.invoice.update({
      where: { id },
      data: { number, year, issuedAt: new Date(), status: InvoiceStatus.UNPAID },
    });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/invoices/${id}/preview`);
  redirect(withSuccess(`/invoices/${id}/preview`, "Invoice issued"));
}

// Deposit received/date is metadata, not document content — same reasoning as
// Paid/Unpaid below, so it's NOT gated by the issued-lock the way saveInvoice
// is. Real deposits are often received (and recorded) after an invoice has
// already been issued and sent, so this must stay editable regardless of
// issuedAt, not just on the pre-issuance draft form.
export async function setInvoiceDeposit(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing invoice id");
  }

  const parsed = depositSchema.safeParse({
    depositReceived: formData.get("depositReceived")?.toString() || undefined,
    depositReceivedAt: formData.get("depositReceivedAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/invoices/${id}?error=` +
        encodeURIComponent("Enter a valid deposit amount.")
    );
  }

  const { depositReceived, depositReceivedAt } = parsed.data;

  await prisma.invoice.update({
    where: { id },
    data: {
      depositReceived: depositReceived != null ? round2(depositReceived) : null,
      depositReceivedAt: depositReceivedAt ? new Date(depositReceivedAt) : null,
    },
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/invoices/${id}/preview`);
  redirect(withSuccess(`/invoices/${id}`, "Deposit updated"));
}

// Paid/Unpaid is metadata, not document content, so it's NOT gated by the
// issued-lock the way saveInvoice is — it can be flipped freely once issued.
// DRAFT has no outgoing transitions here: issuance (a separate action) is
// what moves it to UNPAID. VOIDED is terminal.
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: [],
  UNPAID: [InvoiceStatus.PAID, InvoiceStatus.VOIDED],
  PAID: [InvoiceStatus.UNPAID, InvoiceStatus.VOIDED],
  VOIDED: [],
};

export async function setInvoiceStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !status || !(status in ALLOWED_TRANSITIONS)) {
    throw new Error("Invalid status transition request");
  }
  const targetStatus = status as InvoiceStatus;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (!ALLOWED_TRANSITIONS[invoice.status].includes(targetStatus)) {
    redirect(
      `/invoices/${id}?error=` +
        encodeURIComponent(
          `Can't change status from ${invoice.status} to ${targetStatus}.`
        )
    );
  }

  await prisma.invoice.update({
    where: { id },
    // paidAt tracks the most recent time this invoice became PAID, used by
    // the Pending Receipts view for oldest-first ordering and "days
    // outstanding" - it deliberately doesn't reuse updatedAt (which unrelated
    // edits like a deposit correction also bump). Cleared on any transition
    // away from PAID so re-marking it PAID later starts a fresh period.
    data: {
      status: targetStatus,
      paidAt: targetStatus === "PAID" ? new Date() : null,
    },
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(withSuccess(`/invoices/${id}`, `Status updated to ${targetStatus}`));
}
