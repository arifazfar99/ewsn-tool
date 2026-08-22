"use client";

import { useState } from "react";

export type ItemOption = {
  id: string;
  name: string;
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
}: {
  items: ItemOption[];
  defaultLineItems?: LineItemRow[];
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    defaultLineItems && defaultLineItems.length > 0
      ? defaultLineItems
      : [emptyRow()]
  );

  function updateRow(index: number, patch: Partial<LineItemRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleItemChange(index: number, itemId: string) {
    const item = items.find((it) => it.id === itemId);
    updateRow(index, {
      itemId,
      description: item ? item.name : "",
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
