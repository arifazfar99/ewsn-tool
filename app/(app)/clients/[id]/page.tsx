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
    <div className="max-w-2xl">
      {error && <p className="alert-danger mb-4">{error}</p>}

      <div className="panel p-6">
        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-bold text-ink">Edit Client</h1>
            <p className="mt-0.5 text-xs text-ink-soft">{client.name}</p>
          </div>
        </div>

        <form action={updateClient} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <label className="block">
            <span className="field-label">Email</span>
            <input
              type="email"
              name="email"
              defaultValue={client.email ?? ""}
              className="field-input"
            />
          </label>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <button type="submit" form="delete-client" className="btn-danger">
              Delete
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>

      <form id="delete-client" action={deleteClient}>
        <input type="hidden" name="id" value={client.id} />
      </form>
    </div>
  );
}
