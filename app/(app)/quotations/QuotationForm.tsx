"use client";

import { useState } from "react";
import DocumentLineItemsEditor, {
  type ItemOption,
  type LineItemRow,
} from "@/components/DocumentLineItemsEditor";

type TermsTemplateOption = {
  id: string;
  name: string;
  text: string;
};

type QuotationFormProps = {
  action: (formData: FormData) => void;
  clients: { id: string; name: string }[];
  items: ItemOption[];
  termsTemplates: TermsTemplateOption[];
  quotationId?: string;
  defaultClientId?: string;
  defaultDate?: string;
  defaultNumber?: string | null;
  defaultTitle?: string | null;
  defaultNotes?: string;
  defaultLineItems?: LineItemRow[];
  defaultTermsTemplateId?: string | null;
  defaultTermsText?: string | null;
};

export default function QuotationForm({
  action,
  clients,
  items,
  termsTemplates,
  quotationId,
  defaultClientId,
  defaultDate,
  defaultNumber,
  defaultTitle,
  defaultNotes,
  defaultLineItems,
  defaultTermsTemplateId,
  defaultTermsText,
}: QuotationFormProps) {
  const [termsTemplateId, setTermsTemplateId] = useState(
    defaultTermsTemplateId ?? ""
  );
  const [termsText, setTermsText] = useState(defaultTermsText ?? "");

  function handleTermsTemplateChange(templateId: string) {
    const template = termsTemplates.find((t) => t.id === templateId);
    setTermsTemplateId(templateId);
    setTermsText(template ? template.text : "");
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      {quotationId && <input type="hidden" name="id" value={quotationId} />}

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

      <div className="grid grid-cols-3 gap-5">
        <label className="block">
          <span className="field-label">Client</span>
          <select
            name="clientId"
            required
            defaultValue={defaultClientId ?? ""}
            className="field-input"
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-label">Date</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={defaultDate}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Number</span>
          <input
            type="text"
            name="number"
            placeholder="QT-2026-0001"
            defaultValue={defaultNumber ?? ""}
            className="field-input"
          />
        </label>
      </div>

      <DocumentLineItemsEditor items={items} defaultLineItems={defaultLineItems} />

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
        <span className="field-label">Terms Template</span>
        <select
          name="termsTemplateId"
          value={termsTemplateId}
          onChange={(e) => handleTermsTemplateChange(e.target.value)}
          className="field-input"
        >
          <option value="">No template (custom)</option>
          {termsTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="field-label">Terms</span>
        <textarea
          name="termsText"
          rows={4}
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          className="field-input"
        />
      </label>

      <button type="submit" className="btn-primary">
        Save
      </button>
    </form>
  );
}
