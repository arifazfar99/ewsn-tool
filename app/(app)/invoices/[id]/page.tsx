import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveInvoice } from "../actions";
import InvoiceForm from "../InvoiceForm";

// Invoice content stays editable even after issuance (the one real exception
// in this codebase - see CLAUDE.md), so this page keeps working right up
// until a Receipt exists for it. Deposit editing and status transitions live
// on the owning Project's hub now, not here - this page is content only.
export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      receipt: true,
      sourceDeliveryOrder: {
        include: { sourceQuotation: { select: { projectId: true } } },
      },
    },
  });
  if (!invoice) notFound();

  const projectId = invoice.sourceDeliveryOrder?.sourceQuotation?.projectId;

  if (invoice.receipt) {
    redirect(`/projects/${projectId}`);
  }

  const [items, defaultNumber] = await Promise.all([
    prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    invoice.number
      ? Promise.resolve(invoice.number)
      : previewNextDocumentNumber("INVOICE"),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">
          {invoice.issuedAt ? `Invoice ${invoice.number}` : "Edit Invoice"}
        </h1>
      </div>

      {error && <p className="alert-danger mb-4">{error}</p>}

      <InvoiceForm
        action={saveInvoice}
        invoiceId={invoice.id}
        projectId={projectId ?? undefined}
        clientName={invoice.client.name}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          nameMs: it.nameMs,
          unit: it.unit,
          costPrice: it.costPrice.toNumber(),
        }))}
        defaultTitle={invoice.title ?? ""}
        defaultNumber={defaultNumber}
        defaultNotes={invoice.notes ?? ""}
        defaultBankDetailsText={invoice.bankDetailsText ?? ""}
        defaultDiscountLabel={invoice.discountLabel ?? ""}
        defaultDiscountAmount={invoice.discountAmount?.toNumber().toString() ?? ""}
        language={invoice.language}
        customerSegment={invoice.customerSegment}
        defaultLineItems={invoice.lineItems.map((line) => ({
          itemId: line.itemId,
          description: line.description,
          unit: line.unit,
          quantity: line.quantity.toNumber().toString(),
          unitPrice: line.unitPrice.toNumber().toString(),
        }))}
      />
    </div>
  );
}
