import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DocumentPdf from "@/lib/pdf/DocumentPdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const [quotation, profile] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);

  // Nothing to download before issuance: no number, no locked terms snapshot.
  if (!quotation || !quotation.issuedAt) {
    return new Response("Not found", { status: 404 });
  }

  const lineItems = quotation.lineItems.map((line) => ({
    description: line.description,
    quantity: line.quantity.toNumber(),
    unitPrice: line.unitPrice.toNumber(),
    lineTotal: line.lineTotal.toNumber(),
  }));
  const total = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

  const element = createElement(DocumentPdf, {
    docTypeLabel: "QUOTATION",
    number: quotation.number,
    date: quotation.date,
    business: {
      name: profile?.name ?? "",
      ssmNumber: profile?.ssmNumber ?? "",
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      logoDataUrl: profile?.logoDataUrl ?? null,
    },
    client: {
      name: quotation.client.name,
      address: quotation.client.address,
      contactPerson: quotation.client.contactPerson,
      phone: quotation.client.phone,
      email: quotation.client.email,
    },
    lineItems,
    title: quotation.title,
    notes: quotation.notes,
    language: quotation.language,
    footerLabel: "Terms & Conditions",
    footerText: quotation.termsText,
    total,
  });

  // renderToBuffer's type signature is narrowed to ReactElement<DocumentProps>
  // (the props of react-pdf's own <Document>), so it structurally rejects any
  // custom wrapper component like DocumentPdf even though it renders a
  // <Document> at its root. Upstream typing gap, not avoidable without a cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotation.number}.pdf"`,
    },
  });
}
