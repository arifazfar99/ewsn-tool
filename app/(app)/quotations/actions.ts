"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma, QuotationStatus } from "@/generated/prisma/client";
import { round2 } from "@/lib/money";
import {
  nextDocumentNumber,
  parseYearFromNumber,
  syncCounterFromNumber,
} from "@/lib/numbering";

// itemId is required: QuotationLineItem.itemId is a non-null FK to Item.
const lineItemSchema = z.object({
  itemId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const quotationSchema = z.object({
  clientId: z.string().trim().min(1),
  date: z.string().trim().min(1),
  number: z.string().trim().optional(),
  title: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  termsTemplateId: z.string().trim().optional(),
  termsText: z.string().trim().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});


function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

function parseQuotationForm(formData: FormData) {
  const rawLineItems = formData.get("lineItems")?.toString() ?? "[]";
  let lineItemsJson: unknown = [];
  try {
    lineItemsJson = JSON.parse(rawLineItems);
  } catch {
    // leave as empty array, zod min(1) will reject below
  }

  return quotationSchema.safeParse({
    clientId: formData.get("clientId")?.toString() ?? "",
    date: formData.get("date")?.toString() ?? "",
    number: formData.get("number")?.toString() || undefined,
    title: formData.get("title")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
    termsTemplateId: formData.get("termsTemplateId")?.toString() || undefined,
    termsText: formData.get("termsText")?.toString() || undefined,
    lineItems: lineItemsJson,
  });
}

export async function saveQuotation(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString() || undefined;

  const parsed = parseQuotationForm(formData);
  if (!parsed.success) {
    redirect(
      (id ? `/quotations/${id}` : "/quotations/new") +
        "?error=" +
        encodeURIComponent(
          "Client, date, and at least one valid line item are required."
        )
    );
  }

  const { clientId, date, number, title, notes, termsTemplateId, termsText, lineItems } =
    parsed.data;
  const preparedLines = lineItems.map((line, i) => ({
    itemId: line.itemId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: round2(line.quantity * line.unitPrice),
    sortOrder: i,
  }));
  const year = parseYearFromNumber(number);

  const duplicateNumberError = () =>
    (id ? `/quotations/${id}` : "/quotations/new") +
    "?error=" +
    encodeURIComponent("That quotation number is already in use.");

  const staleTermsTemplateError = () =>
    (id ? `/quotations/${id}` : "/quotations/new") +
    "?error=" +
    encodeURIComponent(
      "That terms template no longer exists — pick another and save again."
    );

  if (id) {
    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: { issuedAt: true },
    });
    if (!existing) {
      throw new Error("Quotation not found");
    }
    if (existing.issuedAt) {
      redirect(
        `/quotations/${id}?error=` +
          encodeURIComponent(
            "This quotation is already issued and can no longer be edited."
          )
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.quotationLineItem.deleteMany({ where: { quotationId: id } });
        await tx.quotation.update({
          where: { id },
          data: {
            clientId,
            date: new Date(date),
            number: number || null,
            year,
            title: title || null,
            notes: notes ?? null,
            termsTemplateId: termsTemplateId || null,
            termsText: termsText ?? null,
            lineItems: { create: preparedLines },
          },
        });
        await syncCounterFromNumber(tx, "QUOTATION", number);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
          redirect(duplicateNumberError());
        }
        if (e.code === "P2003") {
          redirect(staleTermsTemplateError());
        }
      }
      throw e;
    }

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    redirect(withSuccess(`/quotations/${id}`, "Quotation saved"));
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          clientId,
          date: new Date(date),
          number: number || null,
          year,
          title: title || null,
          notes: notes ?? null,
          termsTemplateId: termsTemplateId || null,
          termsText: termsText ?? null,
          lineItems: { create: preparedLines },
        },
      });
      await syncCounterFromNumber(tx, "QUOTATION", number);
      return quotation;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        redirect(duplicateNumberError());
      }
      if (e.code === "P2003") {
        redirect(staleTermsTemplateError());
      }
    }
    throw e;
  }

  revalidatePath("/quotations");
  redirect(withSuccess(`/quotations/${created.id}`, "Quotation saved"));
}

export async function issueQuotation(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing quotation id");
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!quotation) {
    throw new Error("Quotation not found");
  }

  if (quotation.issuedAt) {
    // Already issued: nothing to do, re-downloading uses the stored data.
    redirect(`/quotations/${id}/preview`);
  }

  if (quotation.lineItems.length === 0) {
    redirect(
      `/quotations/${id}?error=` +
        encodeURIComponent("Add at least one line item before generating a PDF.")
    );
  }

  await prisma.$transaction(async (tx) => {
    // A number typed in on the draft (and already synced to the counter via
    // syncCounterFromNumber in saveQuotation) is kept as-is; only fall back
    // to auto-generating one if the draft was left blank. termsText is
    // likewise already populated from the draft save and simply freezes
    // here like every other field, same as title/notes.
    const { number, year } = quotation.number
      ? { number: quotation.number, year: quotation.year ?? new Date().getFullYear() }
      : await nextDocumentNumber(tx, "QUOTATION");
    await tx.quotation.update({
      where: { id },
      data: {
        number,
        year,
        issuedAt: new Date(),
        status: QuotationStatus.SENT,
      },
    });
  });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  revalidatePath(`/quotations/${id}/preview`);
  redirect(withSuccess(`/quotations/${id}/preview`, "Quotation issued"));
}

const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: [],
  SENT: [
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.EXPIRED,
    QuotationStatus.VOIDED,
  ],
  ACCEPTED: [QuotationStatus.VOIDED],
  REJECTED: [QuotationStatus.VOIDED],
  EXPIRED: [QuotationStatus.VOIDED],
  VOIDED: [],
};

export async function setQuotationStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !status || !(status in ALLOWED_TRANSITIONS)) {
    throw new Error("Invalid status transition request");
  }
  const targetStatus = status as QuotationStatus;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!quotation) {
    throw new Error("Quotation not found");
  }

  if (!ALLOWED_TRANSITIONS[quotation.status].includes(targetStatus)) {
    redirect(
      `/quotations/${id}?error=` +
        encodeURIComponent(
          `Can't change status from ${quotation.status} to ${targetStatus}.`
        )
    );
  }

  await prisma.quotation.update({
    where: { id },
    data: { status: targetStatus },
  });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  redirect(withSuccess(`/quotations/${id}`, `Status updated to ${targetStatus}`));
}
