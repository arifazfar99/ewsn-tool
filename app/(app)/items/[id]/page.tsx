import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateItem, toggleItemArchived } from "../actions";
import { StatusBadge } from "@/components/StatusBadge";
import ItemForm from "../ItemForm";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <div>
      {item.archived && (
        <div className="mb-4 max-w-2xl">
          <StatusBadge label="ARCHIVED" tone="pending" />
        </div>
      )}
      {error && <p className="alert-danger mb-4 max-w-2xl">{error}</p>}

      <ItemForm
        action={updateItem}
        itemId={item.id}
        defaultName={item.name}
        defaultNameMs={item.nameMs ?? ""}
        defaultDescription={item.description ?? ""}
        defaultUnit={item.unit}
        defaultCostPrice={item.costPrice.toString()}
        archiveSlot={
          <button type="submit" form="toggle-archived" className="btn-secondary">
            {item.archived ? "Unarchive" : "Archive"}
          </button>
        }
      />

      <form id="toggle-archived" action={toggleItemArchived}>
        <input type="hidden" name="id" value={item.id} />
      </form>
    </div>
  );
}
