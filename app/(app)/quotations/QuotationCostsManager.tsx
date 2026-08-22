"use client";

import { useState } from "react";
import {
  createQuotationCost,
  updateQuotationCost,
  deleteQuotationCost,
} from "./actions";
import { round2 } from "@/lib/money";

type Cost = {
  id: string;
  label: string;
  amount: number;
};

export default function QuotationCostsManager({
  quotationId,
  costs,
  totalSales,
}: {
  quotationId: string;
  costs: Cost[];
  totalSales: number;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalCosts = round2(costs.reduce((sum, c) => sum + c.amount, 0));
  const netSales = round2(totalSales - totalCosts);

  return (
    <div className="panel mb-8 max-w-3xl space-y-4 p-6">
      <h2 className="eyebrow">Costs</h2>

      {costs.length === 0 && (
        <p className="text-sm text-ink-soft">No costs recorded yet.</p>
      )}

      {costs.map((c) =>
        editingId === c.id ? (
          <form
            key={c.id}
            action={updateQuotationCost}
            className="flex flex-wrap items-end gap-3 border-b border-border pb-4"
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="quotationId" value={quotationId} />
            <label className="block">
              <span className="field-label">Label</span>
              <input
                type="text"
                name="label"
                defaultValue={c.label}
                className="field-input"
              />
            </label>
            <label className="block">
              <span className="field-label">Amount (RM)</span>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0"
                defaultValue={c.amount.toFixed(2)}
                className="field-input"
              />
            </label>
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 border-b border-border pb-4"
          >
            <span className="text-sm text-ink">{c.label}</span>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <span className="font-mono text-ink">RM {c.amount.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => setEditingId(c.id)}
                className="link"
              >
                Edit
              </button>
              <form action={deleteQuotationCost}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="quotationId" value={quotationId} />
                <button type="submit" className="btn-danger">
                  Delete
                </button>
              </form>
            </div>
          </div>
        )
      )}

      <form
        action={createQuotationCost}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="quotationId" value={quotationId} />
        <label className="block">
          <span className="field-label">Label</span>
          <input type="text" name="label" className="field-input" />
        </label>
        <label className="block">
          <span className="field-label">Amount (RM)</span>
          <input type="number" name="amount" step="0.01" min="0" className="field-input" />
        </label>
        <button type="submit" className="btn-secondary">
          Add cost
        </button>
      </form>

      <div className="border-t border-border pt-4 text-right text-sm">
        <p className="text-ink-soft">
          Total Costs: <span className="font-mono text-ink">RM {totalCosts.toFixed(2)}</span>
        </p>
        <p className={`font-medium ${netSales < 0 ? "text-danger" : "text-ink"}`}>
          Net Sales: <span className="font-mono">RM {netSales.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
