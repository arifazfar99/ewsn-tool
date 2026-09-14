"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { nextDocumentNumber } from "@/lib/numbering";
import { round2 } from "@/lib/money";

const depositInvoiceSchema = z.object({
  quotationId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

const receivedSchema = z.object({
  receivedAt: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date"),
});

function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

// Creates and issues a DepositInvoice in one step: unlike Quotation/DeliveryOrder/
// Invoice there's no draft to iteratively edit (just one amount field), so
// numbering + issuedAt are assigned atomically at creation rather than in a
// separate two-step draft->issue flow.
export async function createDepositInvoice(formData: FormData) {
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
    include: { depositInvoice: true },
  });
  if (!quotation) {
    throw new Error("Quotation not found");
  }

  const parsed = depositInvoiceSchema.safeParse({
    quotationId,
    amount: formData.get("amount")?.toString() ?? "",
  });
  if (!parsed.success) {
    redirect(
      `/projects/${quotation.projectId}?error=` +
        encodeURIComponent("Enter a valid deposit amount greater than zero.")
    );
  }

  if (quotation.status !== "ACCEPTED" || quotation.depositInvoice) {
    redirect(
      `/projects/${quotation.projectId}?error=` +
        encodeURIComponent(
          "This quotation must be accepted and not already have a deposit invoice."
        )
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const { number, year } = await nextDocumentNumber(tx, "DEPOSIT_INVOICE");
      return tx.depositInvoice.create({
        data: {
          number,
          year,
          amount: round2(parsed.data.amount),
          sourceQuotationId: quotationId,
          issuedAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/projects/${quotation.projectId}?error=` +
          encodeURIComponent("A deposit invoice already exists for this quotation.")
      );
    }
    throw e;
  }

  revalidatePath(`/projects/${quotation.projectId}`);
  redirect(withSuccess(`/projects/${quotation.projectId}`, "Deposit invoice created"));
}

// Received/date is metadata, not document content (same reasoning as
// Invoice's setInvoiceDeposit) - a DepositInvoice is always already issued
// (created+issued atomically), so this is a one-way confirmation, not gated
// by anything beyond the doc existing.
export async function setDepositInvoiceReceived(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing deposit invoice id");
  }

  const depositInvoice = await prisma.depositInvoice.findUnique({
    where: { id },
    select: {
      amount: true,
      sourceQuotation: {
        select: {
          projectId: true,
          deliveryOrder: { select: { invoice: { select: { id: true, depositReceived: true } } } },
        },
      },
    },
  });
  if (!depositInvoice) {
    throw new Error("Deposit invoice not found");
  }
  const projectId = depositInvoice.sourceQuotation?.projectId;

  const parsed = receivedSchema.safeParse({
    receivedAt: formData.get("receivedAt")?.toString() ?? "",
  });
  if (!parsed.success) {
    redirect(
      `/projects/${projectId}?error=` + encodeURIComponent("Enter a valid date received.")
    );
  }

  const receivedAt = new Date(parsed.data.receivedAt);
  const invoice = depositInvoice.sourceQuotation?.deliveryOrder?.invoice;

  await prisma.$transaction(async (tx) => {
    await tx.depositInvoice.update({
      where: { id },
      data: { receivedAt },
    });
    // Mirrors convertDeliveryOrderToInvoice's carry-forward for the case
    // where this deposit is marked received AFTER the DO->Invoice
    // conversion already happened (the usual ordering carries it at
    // conversion time instead, see that function). Never overwrites an
    // already-set depositReceived - that's the user's own running total,
    // which may already be ahead of this deposit's amount.
    if (invoice && invoice.depositReceived == null) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { depositReceived: depositInvoice.amount, depositReceivedAt: receivedAt },
      });
    }
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(withSuccess(`/projects/${projectId}`, "Marked as received"));
}
