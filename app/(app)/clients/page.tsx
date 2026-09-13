import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const where: Prisma.ClientWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { contactPerson: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const clients = await prisma.client.findMany({
    where,
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="page-title">Clients</h1>
        <form method="get" className="relative max-w-xs flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search clients..."
            className="field-input pl-8"
          />
        </form>
        <Link href="/clients/new" className="btn-primary ml-auto">
          New Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {q ? "No clients match your search." : "No clients yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex flex-wrap items-center gap-3.5 rounded-md border border-border bg-surface p-3.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13.5px] font-semibold text-white">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-[160px] flex-1 basis-full sm:basis-0">
                <p className="text-sm font-semibold text-ink">{client.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {client.contactPerson ?? "—"}
                </p>
              </div>
              <div className="min-w-[140px] flex-1 text-xs text-ink-soft">
                <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft/70">
                  Phone
                </span>
                {client.phone ?? "—"}
              </div>
              <div className="min-w-[140px] flex-1 text-xs text-ink-soft">
                <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft/70">
                  Email
                </span>
                {client.email ?? "—"}
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-semibold text-primary">
                {client._count.projects} project{client._count.projects === 1 ? "" : "s"}
              </span>
              <Link
                href={`/clients/${client.id}`}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary-soft"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
