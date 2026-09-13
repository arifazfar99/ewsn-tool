import { prisma } from "@/lib/db";
import { createProject } from "../actions";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl">
      <h1 className="page-title mb-6">New Project</h1>

      {error && <p className="alert-danger mb-4">{error}</p>}

      <form action={createProject} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="clientId">
            Client
          </label>
          <select id="clientId" name="clientId" required className="field-input">
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Defaults to the client's name"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="notes">
            Discussion Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={5}
            placeholder="What's this job about? Notes from the initial conversation..."
            className="field-input"
          />
        </div>

        <button type="submit" className="btn-primary">
          Create Project
        </button>
      </form>
    </div>
  );
}
