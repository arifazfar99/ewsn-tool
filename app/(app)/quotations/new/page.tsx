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

  const [clients, items, suggestedNumber] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    previewNextDocumentNumber("QUOTATION"),
  ]);

  return (
    <div>
      <h1 className="h1-ledger mb-6">New Quotation</h1>

      {error && (
        <p className="stamp stamp-negative mb-4 !block max-w-3xl !text-left">
          {error}
        </p>
      )}

      <QuotationForm
        action={saveQuotation}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          unit: it.unit,
          defaultUnitPrice: it.defaultUnitPrice.toNumber(),
        }))}
        defaultDate={new Date().toISOString().slice(0, 10)}
        defaultNumber={suggestedNumber}
      />
    </div>
  );
}
