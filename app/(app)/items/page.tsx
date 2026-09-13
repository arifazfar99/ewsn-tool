import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { sellPriceFromCost } from "@/lib/pricing";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; showArchived?: string }>;
}) {
  const { q, showArchived } = await searchParams;
  const showAll = showArchived === "1";

  const where: Prisma.ItemWhereInput = {
    ...(showAll ? {} : { archived: false }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nameMs: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const items = await prisma.item.findMany({
    where,
    orderBy: { name: "asc" },
  });

  const archivedLinkParams = new URLSearchParams();
  if (q) archivedLinkParams.set("q", q);
  if (!showAll) archivedLinkParams.set("showArchived", "1");

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="page-title">Items</h1>
        <form method="get" className="relative max-w-xs flex-1">
          {showAll && <input type="hidden" name="showArchived" value="1" />}
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
            placeholder="Search items..."
            className="field-input pl-8"
          />
        </form>
        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href={`/items?${archivedLinkParams.toString()}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              showAll
                ? "border-transparent bg-primary-soft font-semibold text-primary"
                : "border-border bg-surface text-ink-soft"
            }`}
          >
            {showAll ? "Showing archived" : "Show archived"}
          </Link>
          <Link href="/items/new" className="btn-primary">
            New Item
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {q ? "No items match your search." : "No items yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="border-b border-border bg-surface-muted px-3.5 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
                  Item
                </th>
                <th rowSpan={2} className="border-b border-border bg-surface-muted px-3.5 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
                  Unit
                </th>
                <th rowSpan={2} className="border-b border-border bg-surface-muted px-3.5 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
                  Cost
                </th>
                <th colSpan={3} className="border-b border-l border-border bg-surface-muted px-3.5 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
                  Sell Price
                </th>
                <th rowSpan={2} className="border-b border-border bg-surface-muted px-3.5 py-2" />
                <th rowSpan={2} className="border-b border-border bg-surface-muted px-3.5 py-2" />
              </tr>
              <tr>
                <th className="border-b border-l border-border bg-surface-muted px-3.5 pb-2 text-right text-[10px] font-semibold text-ink-soft/75">
                  Direct
                </th>
                <th className="border-b border-border bg-surface-muted px-3.5 pb-2 text-right text-[10px] font-semibold text-ink-soft/75">
                  SME
                </th>
                <th className="border-b border-border bg-surface-muted px-3.5 pb-2 text-right text-[10px] font-semibold text-ink-soft/75">
                  Government
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cost = item.costPrice.toNumber();
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border/60 last:border-b-0 hover:bg-surface-muted/60 ${
                      item.archived ? "opacity-55" : ""
                    }`}
                  >
                    <td className="px-3.5 py-2.5">
                      <p className={`font-semibold text-ink ${item.archived ? "line-through decoration-ink-soft/50" : ""}`}>
                        {item.name}
                      </p>
                      {item.nameMs ? (
                        <p className="mt-0.5 text-xs text-ink-soft">{item.nameMs}</p>
                      ) : (
                        <p className="mt-0.5 text-xs italic text-ink-soft/60">No Malay name</p>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-ink-soft">
                        {item.unit}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      RM {cost.toFixed(2)}
                    </td>
                    <td className="border-l border-border/60 px-3.5 py-2.5 text-right font-mono tabular-nums">
                      RM {sellPriceFromCost(cost, "DIRECT").toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      RM {sellPriceFromCost(cost, "SME").toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      RM {sellPriceFromCost(cost, "GOVERNMENT").toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {item.archived && (
                        <span className="whitespace-nowrap rounded-full bg-surface-muted px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <Link href={`/items/${item.id}`} className="text-xs font-semibold text-primary">
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
