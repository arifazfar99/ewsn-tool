import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="h1-ledger">Clients</h1>
        <Link href="/clients/new" className="btn-primary">
          New Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-ink-soft">No clients yet.</p>
      ) : (
        <table className="table-ledger">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td className="text-ink-soft">
                  {client.contactPerson ?? "-"}
                </td>
                <td className="text-ink-soft">{client.phone ?? "-"}</td>
                <td className="text-ink-soft">{client.email ?? "-"}</td>
                <td className="text-right">
                  <Link href={`/clients/${client.id}`} className="link-ink">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
