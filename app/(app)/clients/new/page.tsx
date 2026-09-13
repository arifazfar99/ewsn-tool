import { createClient } from "../actions";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-2xl">
      {error && <p className="alert-danger mb-4">{error}</p>}

      <div className="panel p-6">
        <h1 className="mb-6 text-base font-bold text-ink">New Client</h1>

        <form action={createClient} className="space-y-4">
          <label className="block">
            <span className="field-label">Name</span>
            <input type="text" name="name" required className="field-input" />
          </label>

          <label className="block">
            <span className="field-label">Address</span>
            <textarea name="address" required rows={3} className="field-input" />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="field-label">Contact Person</span>
              <input type="text" name="contactPerson" className="field-input" />
            </label>

            <label className="block">
              <span className="field-label">Phone</span>
              <input type="text" name="phone" className="field-input" />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Email</span>
            <input type="email" name="email" className="field-input" />
          </label>

          <div className="flex justify-end border-t border-border pt-5">
            <button type="submit" className="btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
