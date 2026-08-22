import { createClient } from "../actions";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="page-title mb-6">New Client</h1>

      {error && <p className="alert-danger mb-4 max-w-xl">{error}</p>}

      <form action={createClient} className="max-w-xl space-y-5">
        <label className="block">
          <span className="field-label">Name</span>
          <input type="text" name="name" required className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Address</span>
          <textarea
            name="address"
            required
            rows={3}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Contact Person</span>
          <input type="text" name="contactPerson" className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Phone</span>
          <input type="text" name="phone" className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Email</span>
          <input type="email" name="email" className="field-input" />
        </label>

        <button type="submit" className="btn-primary">
          Create
        </button>
      </form>
    </div>
  );
}
