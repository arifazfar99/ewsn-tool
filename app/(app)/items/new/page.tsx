import { createItem } from "../actions";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="h1-ledger mb-6">New Item</h1>

      {error && (
        <p className="stamp stamp-negative mb-4 !block max-w-xl !text-left">
          {error}
        </p>
      )}

      <form action={createItem} className="max-w-xl space-y-5">
        <label className="block">
          <span className="field-label">Name</span>
          <input type="text" name="name" required className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Description</span>
          <textarea name="description" rows={3} className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Unit (e.g. pcs, hour)</span>
          <input type="text" name="unit" required className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Default Unit Price</span>
          <input
            type="number"
            name="defaultUnitPrice"
            step="0.01"
            min="0"
            required
            className="field-input"
          />
        </label>

        <button type="submit" className="btn-primary">
          Create
        </button>
      </form>
    </div>
  );
}
