"use client";

import { useState } from "react";
import type { CustomerSegment } from "@/generated/prisma/client";
import { SEGMENT_MARKUP, SEGMENT_LABELS, sellPriceFromCost } from "@/lib/pricing";

const SEGMENTS: CustomerSegment[] = ["DIRECT", "SME", "GOVERNMENT"];

export default function ItemForm({
  action,
  itemId,
  defaultName,
  defaultNameMs,
  defaultDescription,
  defaultUnit,
  defaultCostPrice,
  archiveSlot,
}: {
  action: (formData: FormData) => void;
  itemId?: string;
  defaultName?: string;
  defaultNameMs?: string;
  defaultDescription?: string;
  defaultUnit?: string;
  defaultCostPrice?: string;
  archiveSlot?: React.ReactNode;
}) {
  const [costPrice, setCostPrice] = useState(Number(defaultCostPrice ?? 0));

  return (
    <div className="panel max-w-2xl p-6">
      <h1 className="mb-6 text-base font-bold text-ink">
        {itemId ? "Edit Item" : "New Item"}
      </h1>

      <form action={action} className="space-y-4">
        {itemId && <input type="hidden" name="id" value={itemId} />}

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="field-label">Name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={defaultName}
              className="field-input"
            />
          </label>
          <label className="block">
            <span className="field-label">Malay Name (optional)</span>
            <input
              type="text"
              name="nameMs"
              defaultValue={defaultNameMs}
              className="field-input"
            />
          </label>
        </div>

        <label className="block">
          <span className="field-label">Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={defaultDescription}
            className="field-input"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="field-label">Unit (e.g. pcs, hour)</span>
            <input
              type="text"
              name="unit"
              required
              defaultValue={defaultUnit}
              className="field-input"
            />
          </label>
          <label className="block">
            <span className="field-label">Cost Price (supplier / Shopee)</span>
            <input
              type="number"
              name="costPrice"
              step="0.01"
              min="0"
              required
              value={Number.isNaN(costPrice) ? "" : costPrice}
              onChange={(e) => setCostPrice(e.target.valueAsNumber)}
              className="field-input"
            />
          </label>
        </div>

        <div className="flex gap-4 rounded-md bg-primary-soft px-3.5 py-3">
          {SEGMENTS.map((segment) => (
            <div key={segment} className="flex-1 text-center">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-primary/75">
                {SEGMENT_LABELS[segment]} +{SEGMENT_MARKUP[segment] * 100}%
              </p>
              <p className="mt-0.5 font-mono text-[15px] font-bold text-primary">
                RM {sellPriceFromCost(Number.isNaN(costPrice) ? 0 : costPrice, segment).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          Sell price is computed automatically per customer segment when this
          item is added to a document.
        </p>

        <div className="flex items-center justify-between border-t border-border pt-5">
          {archiveSlot ?? <span />}
          <button type="submit" className="btn-primary">
            {itemId ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
