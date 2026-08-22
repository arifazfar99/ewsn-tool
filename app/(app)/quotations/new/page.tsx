import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveQuotation } from "../actions";
import QuotationForm from "../QuotationForm";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [clients, items, suggestedNumber, termsTemplates] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    previewNextDocumentNumber("QUOTATION"),
    prisma.quotationTermsTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  const defaultTemplate = termsTemplates.find((t) => t.isDefault);

  return (
    <div>
      <h1 className="page-title mb-6">New Quotation</h1>

      {error && <p className="alert-danger mb-4 max-w-3xl">{error}</p>}

      <QuotationForm
        action={saveQuotation}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          unit: it.unit,
          defaultUnitPrice: it.defaultUnitPrice.toNumber(),
        }))}
        termsTemplates={termsTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          text: t.text,
        }))}
        defaultDate={new Date().toISOString().slice(0, 10)}
        defaultNumber={suggestedNumber}
        defaultTermsTemplateId={defaultTemplate?.id ?? ""}
        defaultTermsText={defaultTemplate?.text ?? ""}
      />
    </div>
  );
}
