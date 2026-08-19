"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { nextDocumentNumber } from "@/lib/numbering";

const depositInvoiceSchema = z.object({
  quotationId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

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

  const parsed = depositInvoiceSchema.safeParse({
    quotationId,
    amount: formData.get("amount")?.toString() ?? "",
  });
  if (!parsed.success) {
    redirect(
      `/quotations/${quotationId}?error=` +
        encodeURIComponent("Enter a valid deposit amount greater than zero.")
    );
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { depositInvoice: true },
  });
  if (!quotation) {
    throw new Error("Quotation not found");
  }
  if (quotation.status !== "ACCEPTED" || quotation.depositInvoice) {
    redirect(
      `/quotations/${quotationId}?error=` +
        encodeURIComponent(
          "This quotation must be accepted and not already have a deposit invoice."
        )
    );
  }

  let depositInvoice;
  try {
    depositInvoice = await prisma.$transaction(async (tx) => {
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
        `/quotations/${quotationId}?error=` +
          encodeURIComponent("A deposit invoice already exists for this quotation.")
      );
    }
    throw e;
  }

  revalidatePath(`/quotations/${quotationId}`);
  redirect(
    withSuccess(`/deposit-invoices/${depositInvoice.id}/preview`, "Deposit invoice created")
  );
}
