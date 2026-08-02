"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { QuotationStatus, DeliveryOrderStatus } from "@/generated/prisma/client";
import { nextDocumentNumber } from "@/lib/numbering";

// itemId is required: DeliveryOrderLineItem.itemId is a non-null FK to Item.
const lineItemSchema = z.object({
  itemId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const deliveryOrderSchema = z.object({
  notes: z.string().trim().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseDeliveryOrderForm(formData: FormData) {
  const rawLineItems = formData.get("lineItems")?.toString() ?? "[]";
  let lineItemsJson: unknown = [];
  try {
    lineItemsJson = JSON.parse(rawLineItems);
  } catch {
    // leave as empty array, zod min(1) will reject below
  }

  return deliveryOrderSchema.safeParse({
    notes: formData.get("notes")?.toString() || undefined,
    lineItems: lineItemsJson,
  });
}

// Converts an ACCEPTED Quotation into a DRAFT DeliveryOrder, copying its
// client and line items. One DO per Quotation — sourceQuotationId is @unique,
// so a second conversion attempt fails even if this app-level check is
// bypassed.
export async function convertQuotationToDeliveryOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const quotationId = formData.get("quotationId")?.toString();
  if (!quotationId) {
    throw new Error("Missing quotation id");
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { lineItems: true, deliveryOrder: true },
  });
  if (!quotation) {
    throw new Error("Quotation not found");
  }

  if (quotation.status !== QuotationStatus.ACCEPTED || quotation.deliveryOrder) {
    redirect(
      `/quotations/${quotationId}?error=` +
        encodeURIComponent(
          "Quotation must be accepted and not already converted."
        )
    );
  }

  const deliveryOrder = await prisma.$transaction(async (tx) => {
    return tx.deliveryOrder.create({
      data: {
        date: new Date(),
        clientId: quotation.clientId,
        notes: quotation.notes,
        sourceQuotationId: quotation.id,
        lineItems: {
          create: quotation.lineItems.map((line) => ({
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

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/delivery-orders");
  redirect(`/delivery-orders/${deliveryOrder.id}`);
}

export async function saveDeliveryOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing delivery order id");
  }

  const parsed = parseDeliveryOrderForm(formData);
  if (!parsed.success) {
    redirect(
      `/delivery-orders/${id}?error=` +
        encodeURIComponent("At least one valid line item is required.")
    );
  }

  const { notes, lineItems } = parsed.data;
  const preparedLines = lineItems.map((line, i) => ({
    itemId: line.itemId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: round2(line.quantity * line.unitPrice),
    sortOrder: i,
  }));

  const existing = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: { issuedAt: true },
  });
  if (!existing) {
    throw new Error("Delivery order not found");
  }
  if (existing.issuedAt) {
    redirect(
      `/delivery-orders/${id}?error=` +
        encodeURIComponent(
          "This delivery order is already issued and can no longer be edited."
        )
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryOrderLineItem.deleteMany({ where: { deliveryOrderId: id } });
    await tx.deliveryOrder.update({
      where: { id },
      data: {
        notes: notes ?? null,
        lineItems: { create: preparedLines },
      },
    });
  });

  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${id}`);
  redirect(`/delivery-orders/${id}`);
}

export async function issueDeliveryOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing delivery order id");
  }

  const deliveryOrder = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!deliveryOrder) {
    throw new Error("Delivery order not found");
  }

  if (deliveryOrder.issuedAt) {
    // Already issued: nothing to do, re-downloading uses the stored data.
    redirect(`/delivery-orders/${id}/preview`);
  }

  if (deliveryOrder.lineItems.length === 0) {
    redirect(
      `/delivery-orders/${id}?error=` +
        encodeURIComponent("Add at least one line item before generating a PDF.")
    );
  }

  await prisma.$transaction(async (tx) => {
    const { number, year } = await nextDocumentNumber(tx, "DELIVERY_ORDER");
    await tx.deliveryOrder.update({
      where: { id },
      data: { number, year, issuedAt: new Date() },
    });
  });

  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${id}`);
  revalidatePath(`/delivery-orders/${id}/preview`);
  redirect(`/delivery-orders/${id}/preview`);
}

// Issuing (numbering/PDF) does NOT change status away from DRAFT — a DO can
// be locked and printed while still "not yet physically delivered". DELIVERED
// only reachable from an issued DRAFT; nothing transitions out of VOIDED.
const ALLOWED_TRANSITIONS: Record<DeliveryOrderStatus, DeliveryOrderStatus[]> = {
  DRAFT: [DeliveryOrderStatus.DELIVERED, DeliveryOrderStatus.VOIDED],
  DELIVERED: [DeliveryOrderStatus.VOIDED],
  VOIDED: [],
};

export async function setDeliveryOrderStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !status || !(status in ALLOWED_TRANSITIONS)) {
    throw new Error("Invalid status transition request");
  }
  const targetStatus = status as DeliveryOrderStatus;

  const deliveryOrder = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: { status: true, issuedAt: true },
  });
  if (!deliveryOrder) {
    throw new Error("Delivery order not found");
  }

  if (!ALLOWED_TRANSITIONS[deliveryOrder.status].includes(targetStatus)) {
    redirect(
      `/delivery-orders/${id}?error=` +
        encodeURIComponent(
          `Can't change status from ${deliveryOrder.status} to ${targetStatus}.`
        )
    );
  }

  if (targetStatus === DeliveryOrderStatus.DELIVERED && !deliveryOrder.issuedAt) {
    redirect(
      `/delivery-orders/${id}?error=` +
        encodeURIComponent("Generate the PDF before marking this delivered.")
    );
  }

  await prisma.deliveryOrder.update({
    where: { id },
    data: { status: targetStatus },
  });

  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${id}`);
  redirect(`/delivery-orders/${id}`);
}
