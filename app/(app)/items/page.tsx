import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const { showArchived } = await searchParams;
  const showAll = showArchived === "1";

  const items = await prisma.item.findMany({
    where: showAll ? {} : { archived: false },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Items</h1>
        <div className="flex items-center gap-4">
          <Link
            href={showAll ? "/items" : "/items?showArchived=1"}
            className="link"
          >
            {showAll ? "Hide archived" : "Show archived"}
          </Link>
          <Link href="/items/new" className="btn-primary">
            New Item
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">No items yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Default Unit Price</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="text-ink-soft">{item.unit}</td>
                <td className="num">
                  RM {item.defaultUnitPrice.toNumber().toFixed(2)}
                </td>
                <td>
                  {item.archived && (
                    <StatusBadge label="ARCHIVED" tone="pending" />
                  )}
                </td>
                <td className="text-right">
                  <Link href={`/items/${item.id}`} className="link">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
