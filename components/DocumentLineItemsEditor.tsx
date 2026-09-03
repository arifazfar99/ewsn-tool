"use client";

import { useState } from "react";
import type { DocumentLanguage } from "@/lib/pdf/labels";

export type ItemOption = {
  id: string;
  name: string;
  nameMs?: string | null;
  unit: string;
  defaultUnitPrice: number;
};

export type LineItemRow = {
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function emptyRow(): LineItemRow {
  return { itemId: "", description: "", quantity: "1", unitPrice: "0" };
}

function lineTotal(row: LineItemRow): number {
  const qty = Number.parseFloat(row.quantity);
  const price = Number.parseFloat(row.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

// Shared line-item editor for Quotation/DeliveryOrder/Invoice forms - owns
// row state and the running total internally, and renders the hidden
// `lineItems` JSON input each parent's Server Action already expects, so no
// action needs to change when a form switches to this component.
export default function DocumentLineItemsEditor({
  items,
  defaultLineItems,
  language = "EN",
}: {
  items: ItemOption[];
  defaultLineItems?: LineItemRow[];
  language?: DocumentLanguage;
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    defaultLineItems && defaultLineItems.length > 0
      ? defaultLineItems
      : [emptyRow()]
  );

  // Resync already-picked rows when the document's language changes, so a
  // row filled in under one language doesn't silently stay in that language
  // after the user switches. Only rows whose description still exactly
  // matches the item's catalog name (in either language) are touched - a
  // description the user has hand-edited away from the catalog default is
  // left alone. Adjusts state during render (comparing against the last
  // seen language via a ref-like prevLanguage state) rather than a
  // useEffect, matching this project's established pattern (see the
  // toast-dedup / React Compiler note elsewhere in this repo's history).
  const [prevLanguage, setPrevLanguage] = useState(language);
  if (language !== prevLanguage) {
    setPrevLanguage(language);
    setRows((prev) =>
      prev.map((row) => {
        const item = items.find((it) => it.id === row.itemId);
        if (!item) return row;
        const catalogNames = [item.name, item.nameMs].filter(
          (v): v is string => Boolean(v)
        );
        if (!catalogNames.includes(row.description)) return row;
        const nextDescription =
          language === "MS" ? item.nameMs || item.name : item.name;
        return row.description === nextDescription
          ? row
          : { ...row, description: nextDescription };
      })
    );
  }

  function updateRow(index: number, patch: Partial<LineItemRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleItemChange(index: number, itemId: string) {
    const item = items.find((it) => it.id === itemId);
    const description = item
      ? language === "MS"
        ? item.nameMs || item.name
        : item.name
      : "";
    updateRow(index, {
      itemId,
      description,
      unitPrice: item ? item.defaultUnitPrice.toString() : "0",
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const total = rows.reduce((sum, row) => sum + lineTotal(row), 0);

  return (
    <>
      <input
        type="hidden"
        name="lineItems"
        value={JSON.stringify(
          rows.map((row) => ({
            itemId: row.itemId,
            description: row.description,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
          }))
        )}
      />

      <div>
        <span className="field-label">Line Items</span>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <select
                value={row.itemId}
                onChange={(e) => handleItemChange(i, e.target.value)}
                className="field-input w-40"
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateRow(i, { description: e.target.value })}
                className="field-input flex-1"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: e.target.value })}
                className="field-input w-20"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Unit Price"
                value={row.unitPrice}
                onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                className="field-input w-28"
              />
              <div className="w-24 pt-1.5 text-right font-mono text-sm text-ink-soft">
                {lineTotal(row).toFixed(2)}
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="pt-1.5 text-sm font-medium text-danger hover:text-danger/80 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="btn-secondary mt-3">
          Add Line
        </button>
      </div>

      <div className="flex justify-end text-sm">
        <div className="flex w-64 justify-between border-t border-border pt-2 font-medium text-ink">
          <span>Total</span>
          <span className="font-mono">RM {total.toFixed(2)}</span>
        </div>
      </div>
    </>
  );
}
