import { createItem } from "../actions";
import ItemForm from "../ItemForm";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      {error && <p className="alert-danger mb-4 max-w-2xl">{error}</p>}
      <ItemForm action={createItem} />
    </div>
  );
}
