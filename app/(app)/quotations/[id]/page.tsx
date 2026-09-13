import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveQuotation } from "../actions";
import QuotationForm from "../QuotationForm";

// Content stays editable only while a Quotation is still a draft - once
// issued there's nothing left to do on this page (number/content locked,
// every workflow action lives on the owning Project's hub now), so this
// just hands off there.
export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quotation) notFound();

  if (quotation.issuedAt) {
    redirect(`/projects/${quotation.projectId}`);
  }

  const [clients, items, defaultNumber, termsTemplates] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    quotation.number
      ? Promise.resolve(quotation.number)
      : previewNextDocumentNumber("QUOTATION"),
    prisma.quotationTermsTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="page-title mb-6">Edit Quotation</h1>

      {error && <p className="alert-danger mb-4 max-w-3xl">{error}</p>}

      <QuotationForm
        action={saveQuotation}
        quotationId={quotation.id}
        projectId={quotation.projectId ?? undefined}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          nameMs: it.nameMs,
          unit: it.unit,
          costPrice: it.costPrice.toNumber(),
        }))}
        defaultClientId={quotation.clientId}
        defaultDate={quotation.date.toISOString().slice(0, 10)}
        defaultNumber={defaultNumber}
        defaultTitle={quotation.title ?? ""}
        defaultLanguage={quotation.language}
        defaultCustomerSegment={quotation.customerSegment}
        defaultNotes={quotation.notes ?? ""}
        defaultLineItems={quotation.lineItems.map((line) => ({
          itemId: line.itemId,
          description: line.description,
          unit: line.unit,
          quantity: line.quantity.toNumber().toString(),
          unitPrice: line.unitPrice.toNumber().toString(),
        }))}
        termsTemplates={termsTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          text: t.text,
        }))}
        defaultTermsTemplateId={quotation.termsTemplateId ?? ""}
        defaultTermsText={quotation.termsText ?? ""}
      />
    </div>
  );
}
