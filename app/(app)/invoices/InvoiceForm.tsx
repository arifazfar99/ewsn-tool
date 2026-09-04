"use client";

import DocumentLineItemsEditor, {
  type ItemOption,
  type LineItemRow,
} from "@/components/DocumentLineItemsEditor";
import type { DocumentLanguage } from "@/lib/pdf/labels";

type InvoiceFormProps = {
  action: (formData: FormData) => void;
  invoiceId: string;
  clientName: string;
  items: ItemOption[];
  defaultTitle?: string | null;
  defaultNumber?: string | null;
  defaultNotes?: string;
  defaultBankDetailsText?: string;
  defaultLineItems?: LineItemRow[];
  defaultDiscountLabel?: string;
  defaultDiscountAmount?: string;
  language?: DocumentLanguage;
};

export default function InvoiceForm({
  action,
  invoiceId,
  clientName,
  items,
  defaultTitle,
  defaultNumber,
  defaultNotes,
  defaultBankDetailsText,
  defaultLineItems,
  defaultDiscountLabel,
  defaultDiscountAmount,
  language,
}: InvoiceFormProps) {
  return (
    <form action={action} className="max-w-3xl space-y-6">
      <input type="hidden" name="id" value={invoiceId} />

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
          placeholder="INV-2026-0001"
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

      <div className="space-y-3">
        <span className="field-label">Discount (optional)</span>
        <div className="grid grid-cols-2 gap-5">
          <label className="block">
            <span className="field-label">Label</span>
            <input
              type="text"
              name="discountLabel"
              placeholder="e.g. Item substitution - camera out of stock"
              defaultValue={defaultDiscountLabel ?? ""}
              className="field-input"
            />
          </label>

          <label className="block">
            <span className="field-label">Amount (RM)</span>
            <input
              type="number"
              name="discountAmount"
              step="0.01"
              min="0"
              defaultValue={defaultDiscountAmount ?? ""}
              className="field-input"
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="field-label">Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">Bank Details</span>
        <textarea
          name="bankDetailsText"
          rows={4}
          defaultValue={defaultBankDetailsText}
          className="field-input"
        />
      </label>

      <button type="submit" className="btn-primary">
        Save
      </button>
    </form>
  );
}
