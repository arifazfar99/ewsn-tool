import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveQuotation } from "../actions";
import QuotationForm from "../QuotationForm";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; projectId?: string }>;
}) {
  const { error, projectId } = await searchParams;
  if (!projectId) {
    // Every Quotation now lives under a Project - start one there instead
    // of creating a document with nothing to belong to.
    notFound();
  }

  const [project, clients, items, suggestedNumber, termsTemplates] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    previewNextDocumentNumber("QUOTATION"),
    prisma.quotationTermsTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!project) notFound();
  const defaultTemplate = termsTemplates.find((t) => t.isDefault);

  return (
    <div>
      <h1 className="page-title mb-6">New Quotation</h1>

      {error && <p className="alert-danger mb-4 max-w-3xl">{error}</p>}

      <QuotationForm
        action={saveQuotation}
        projectId={project.id}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          nameMs: it.nameMs,
          unit: it.unit,
          costPrice: it.costPrice.toNumber(),
        }))}
        termsTemplates={termsTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          text: t.text,
        }))}
        defaultClientId={project.clientId}
        defaultDate={new Date().toISOString().slice(0, 10)}
        defaultNumber={suggestedNumber}
        defaultTitle={project.title}
        defaultTermsTemplateId={defaultTemplate?.id ?? ""}
        defaultTermsText={defaultTemplate?.text ?? ""}
      />
    </div>
  );
}
