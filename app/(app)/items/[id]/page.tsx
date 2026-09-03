import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateItem, toggleItemArchived } from "../actions";
import { StatusBadge } from "@/components/StatusBadge";

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Edit Item</h1>
        {item.archived && <StatusBadge label="ARCHIVED" tone="pending" />}
      </div>

      {error && <p className="alert-danger mb-4 max-w-xl">{error}</p>}

      <form action={updateItem} className="max-w-xl space-y-5">
        <input type="hidden" name="id" value={item.id} />

        <label className="block">
          <span className="field-label">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={item.name}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Malay Name (optional)</span>
          <input
            type="text"
            name="nameMs"
            defaultValue={item.nameMs ?? ""}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={item.description ?? ""}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Unit (e.g. pcs, hour)</span>
          <input
            type="text"
            name="unit"
            required
            defaultValue={item.unit}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Default Unit Price</span>
          <input
            type="number"
            name="defaultUnitPrice"
            step="0.01"
            min="0"
            required
            defaultValue={item.defaultUnitPrice.toString()}
            className="field-input"
          />
        </label>

        <button type="submit" className="btn-primary">
          Save
        </button>
      </form>

      <form action={toggleItemArchived} className="mt-8 max-w-xl">
        <input type="hidden" name="id" value={item.id} />
        <button type="submit" className="btn-secondary">
          {item.archived ? "Unarchive" : "Archive"}
        </button>
      </form>
    </div>
  );
}
