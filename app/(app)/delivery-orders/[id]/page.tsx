import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { previewNextDocumentNumber } from "@/lib/numbering";
import { saveDeliveryOrder } from "../actions";
import DeliveryOrderForm from "../DeliveryOrderForm";

// Content stays editable only while a Delivery Order is still a draft - once
// issued there's nothing left to do on this page (number/content locked,
// every workflow action lives on the owning Project's hub now), so this
// just hands off there.
export default async function DeliveryOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const deliveryOrder = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      client: true,
      sourceQuotation: { select: { projectId: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!deliveryOrder) notFound();

  if (deliveryOrder.issuedAt) {
    redirect(`/projects/${deliveryOrder.sourceQuotation?.projectId}`);
  }

  const [items, defaultNumber] = await Promise.all([
    prisma.item.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    deliveryOrder.number
      ? Promise.resolve(deliveryOrder.number)
      : previewNextDocumentNumber("DELIVERY_ORDER"),
  ]);

  return (
    <div>
      <h1 className="page-title mb-6">Edit Delivery Order</h1>

      {error && <p className="alert-danger mb-4 max-w-3xl">{error}</p>}

      <DeliveryOrderForm
        action={saveDeliveryOrder}
        deliveryOrderId={deliveryOrder.id}
        projectId={deliveryOrder.sourceQuotation?.projectId ?? undefined}
        clientName={deliveryOrder.client.name}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          nameMs: it.nameMs,
          unit: it.unit,
          costPrice: it.costPrice.toNumber(),
        }))}
        defaultTitle={deliveryOrder.title ?? ""}
        defaultNumber={defaultNumber}
        defaultNotes={deliveryOrder.notes ?? ""}
        language={deliveryOrder.language}
        customerSegment={deliveryOrder.customerSegment}
        defaultLineItems={deliveryOrder.lineItems.map((line) => ({
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
