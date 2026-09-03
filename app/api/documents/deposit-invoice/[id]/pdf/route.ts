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

  const [depositInvoice, profile] = await Promise.all([
    prisma.depositInvoice.findUnique({
      where: { id },
      include: { sourceQuotation: { include: { client: true } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!depositInvoice || !depositInvoice.sourceQuotation) {
    return new Response("Not found", { status: 404 });
  }

  const quotation = depositInvoice.sourceQuotation;
  const amount = depositInvoice.amount.toNumber();

  const element = createElement(DocumentPdf, {
    docTypeLabel: "DEPOSIT INVOICE",
    number: depositInvoice.number,
    date: depositInvoice.date,
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
    lineItems: [
      {
        description: `Deposit for Quotation ${quotation.number}${
          quotation.title ? ` — ${quotation.title}` : ""
        }`,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
    ],
    title: null,
    notes: null,
    language: quotation.language,
    footerLabel: "Bank Details",
    footerText: profile?.bankDetailsText ?? null,
    total: amount,
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
      "Content-Disposition": `attachment; filename="${depositInvoice.number}.pdf"`,
    },
  });
}
