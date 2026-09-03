"use client";

import DocumentLineItemsEditor, {
  type ItemOption,
  type LineItemRow,
} from "@/components/DocumentLineItemsEditor";
import type { DocumentLanguage } from "@/lib/pdf/labels";

type DeliveryOrderFormProps = {
  action: (formData: FormData) => void;
  deliveryOrderId: string;
  clientName: string;
  items: ItemOption[];
  defaultTitle?: string | null;
  defaultNumber?: string | null;
  defaultNotes?: string;
  defaultLineItems?: LineItemRow[];
  language?: DocumentLanguage;
};

export default function DeliveryOrderForm({
  action,
  deliveryOrderId,
  clientName,
  items,
  defaultTitle,
  defaultNumber,
  defaultNotes,
  defaultLineItems,
  language,
}: DeliveryOrderFormProps) {
  return (
    <form action={action} className="max-w-3xl space-y-6">
      <input type="hidden" name="id" value={deliveryOrderId} />

      <label className="block">
        <span className="field-label">Title</span>
        <input
          type="text"
          name="title"
          placeholder="e.g. Website Redesign - Phase 1"
          defaultValue={defaultTitle ?? ""}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">Number</span>
        <input
          type="text"
          name="number"
          placeholder="DO-2026-0001"
          defaultValue={defaultNumber ?? ""}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">Client</span>
        <div className="field-input bg-surface-muted text-ink-soft">
          {clientName}
        </div>
      </label>

      <DocumentLineItemsEditor
        items={items}
        defaultLineItems={defaultLineItems}
        language={language}
      />

      <label className="block">
        <span className="field-label">Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="field-input"
        />
      </label>

      <button type="submit" className="btn-primary">
        Save
      </button>
    </form>
  );
}
