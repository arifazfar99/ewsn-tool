import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DocumentPdf from "@/lib/pdf/DocumentPdf";
import type { DocumentLanguage } from "@/lib/pdf/labels";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const [receipt, profile] = await Promise.all([
    prisma.receipt.findUnique({
      where: { id },
      include: {
        sourceDepositInvoice: {
          include: { sourceQuotation: { include: { client: true } } },
        },
        sourceInvoice: { include: { client: true } },
      },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);

  // Nothing to download before issuance: no number assigned yet. In
  // practice a Receipt is always created+issued atomically, so this is a
  // not-found guard rather than a reachable draft state.
  if (!receipt || !receipt.issuedAt) {
    return new Response("Not found", { status: 404 });
  }

  const amount = receipt.amount.toNumber();

  let client: {
    name: string;
    address: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
  };
  let description: string;
  let language: DocumentLanguage;

  if (receipt.sourceDepositInvoice?.sourceQuotation) {
    const quotation = receipt.sourceDepositInvoice.sourceQuotation;
    client = quotation.client;
    description = `Deposit received for Quotation ${quotation.number}${
      quotation.title ? ` — ${quotation.title}` : ""
    } (Deposit Invoice ${receipt.sourceDepositInvoice.number})`;
    language = quotation.language;
  } else if (receipt.sourceInvoice) {
    client = receipt.sourceInvoice.client;
    description = `Payment received for Invoice ${receipt.sourceInvoice.number}`;
    language = receipt.sourceInvoice.language;
  } else {
    return new Response("Not found", { status: 404 });
  }

  const element = createElement(DocumentPdf, {
    docTypeLabel: "RECEIPT",
    number: receipt.number,
    date: receipt.date,
    business: {
      name: profile?.name ?? "",
      ssmNumber: profile?.ssmNumber ?? "",
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      logoDataUrl: profile?.logoDataUrl ?? null,
    },
    client: {
      name: client.name,
      address: client.address,
      contactPerson: client.contactPerson,
      phone: client.phone,
      email: client.email,
    },
    lineItems: [
      {
        description,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
    ],
    title: null,
    notes: null,
    language,
    footerLabel: null,
    footerText: null,
    total: amount,
    showThankYou: true,
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
      "Content-Disposition": `attachment; filename="${receipt.number}.pdf"`,
    },
  });
}
