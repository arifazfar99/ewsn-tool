import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { issueDeliveryOrder } from "../../actions";
import PreviewClient from "./PreviewClient";

export default async function DeliveryOrderPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [deliveryOrder, profile] = await Promise.all([
    prisma.deliveryOrder.findUnique({
      where: { id },
      include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!deliveryOrder) notFound();

  const lineItems = deliveryOrder.lineItems.map((line) => ({
    description: line.description,
    quantity: line.quantity.toNumber(),
    unitPrice: line.unitPrice.toNumber(),
    lineTotal: line.lineTotal.toNumber(),
  }));
  const total = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

  const pdfProps = {
    docTypeLabel: "DELIVERY ORDER",
    number: deliveryOrder.number,
    date: deliveryOrder.date,
    business: {
      name: profile?.name ?? "",
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
    notes: deliveryOrder.notes,
    footerLabel: null,
    footerText: null,
    total,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="h1-ledger">Delivery Order Preview</h1>
        <div className="flex items-center gap-4">
          {deliveryOrder.issuedAt ? (
            <a
              href={`/api/documents/delivery-order/${deliveryOrder.id}/pdf`}
              className="btn-primary"
            >
              Download PDF
            </a>
          ) : (
            <form action={issueDeliveryOrder}>
              <input type="hidden" name="id" value={deliveryOrder.id} />
              <button type="submit" className="btn-primary">
                Generate PDF
              </button>
            </form>
          )}
        </div>
      </div>

      <PreviewClient {...pdfProps} />
    </div>
  );
}
