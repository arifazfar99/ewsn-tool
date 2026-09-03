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

  const [deliveryOrder, profile] = await Promise.all([
    prisma.deliveryOrder.findUnique({
      where: { id },
      include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);

  // Nothing to download before issuance: no number assigned yet.
  if (!deliveryOrder || !deliveryOrder.issuedAt) {
    return new Response("Not found", { status: 404 });
  }

  const lineItems = deliveryOrder.lineItems.map((line) => ({
    description: line.description,
    quantity: line.quantity.toNumber(),
    unitPrice: line.unitPrice.toNumber(),
    lineTotal: line.lineTotal.toNumber(),
  }));
  const total = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

  const element = createElement(DocumentPdf, {
    docTypeLabel: "DELIVERY ORDER",
    number: deliveryOrder.number,
    date: deliveryOrder.date,
    business: {
      name: profile?.name ?? "",
      ssmNumber: profile?.ssmNumber ?? "",
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      logoDataUrl: profile?.logoDataUrl ?? null,
    },
    client: {
      name: deliveryOrder.client.name,
      address: deliveryOrder.client.address,
      contactPerson: deliveryOrder.client.contactPerson,
      phone: deliveryOrder.client.phone,
      email: deliveryOrder.client.email,
    },
    lineItems,
    title: deliveryOrder.title,
    notes: deliveryOrder.notes,
    language: deliveryOrder.language,
    footerLabel: null,
    footerText: null,
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
      "Content-Disposition": `attachment; filename="${deliveryOrder.number}.pdf"`,
    },
  });
}
