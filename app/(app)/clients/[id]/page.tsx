import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateClient, deleteClient } from "../actions";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <div>
      <h1 className="page-title mb-6">Edit Client</h1>

      {error && <p className="alert-danger mb-4 max-w-xl">{error}</p>}

      <form action={updateClient} className="max-w-xl space-y-5">
        <input type="hidden" name="id" value={client.id} />

        <label className="block">
          <span className="field-label">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={client.name}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Address</span>
          <textarea
            name="address"
            required
            rows={3}
            defaultValue={client.address}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Contact Person</span>
          <input
            type="text"
            name="contactPerson"
            defaultValue={client.contactPerson ?? ""}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Phone</span>
          <input
            type="text"
            name="phone"
            defaultValue={client.phone ?? ""}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Email</span>
          <input
            type="email"
            name="email"
            defaultValue={client.email ?? ""}
            className="field-input"
          />
        </label>

        <button type="submit" className="btn-primary">
          Save
        </button>
      </form>

      <form action={deleteClient} className="mt-8 max-w-xl">
        <input type="hidden" name="id" value={client.id} />
        <button type="submit" className="btn-danger">
          Delete
        </button>
      </form>
    </div>
  );
}
