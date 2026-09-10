import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { sellPriceFromCost } from "@/lib/pricing";

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
              <th>Cost Price</th>
              <th>Direct</th>
              <th>SME</th>
              <th>Government</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cost = item.costPrice.toNumber();
              return (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.nameMs ? (
                    <div className="text-xs text-ink-soft">{item.nameMs}</div>
                  ) : (
                    <div className="text-xs text-ink-soft/60">No Malay name</div>
                  )}
                </td>
                <td className="text-ink-soft">{item.unit}</td>
                <td className="num">RM {cost.toFixed(2)}</td>
                <td className="num text-ink-soft">
                  RM {sellPriceFromCost(cost, "DIRECT").toFixed(2)}
                </td>
                <td className="num text-ink-soft">
                  RM {sellPriceFromCost(cost, "SME").toFixed(2)}
                </td>
                <td className="num text-ink-soft">
                  RM {sellPriceFromCost(cost, "GOVERNMENT").toFixed(2)}
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
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
