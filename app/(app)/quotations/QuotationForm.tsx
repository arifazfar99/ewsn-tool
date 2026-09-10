"use client";

import Link from "next/link";
import { useState } from "react";
import DocumentLineItemsEditor, {
  type ItemOption,
  type LineItemRow,
} from "@/components/DocumentLineItemsEditor";
import type { DocumentLanguage } from "@/lib/pdf/labels";
import type { CustomerSegment } from "@/generated/prisma/client";
import { SEGMENT_LABELS } from "@/lib/pricing";

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
  defaultLanguage?: DocumentLanguage;
  defaultCustomerSegment?: CustomerSegment;
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
  defaultLanguage,
  defaultCustomerSegment,
  defaultNotes,
  defaultLineItems,
  defaultTermsTemplateId,
  defaultTermsText,
}: QuotationFormProps) {
  const [termsTemplateId, setTermsTemplateId] = useState(
    defaultTermsTemplateId ?? ""
  );
  const [termsText, setTermsText] = useState(defaultTermsText ?? "");
  const [language, setLanguage] = useState<DocumentLanguage>(defaultLanguage ?? "EN");
  const [customerSegment, setCustomerSegment] = useState<CustomerSegment>(
    defaultCustomerSegment ?? "DIRECT"
  );

  function handleTermsTemplateChange(templateId: string) {
    const template = termsTemplates.find((t) => t.id === templateId);
    setTermsTemplateId(templateId);
    setTermsText(template ? template.text : "");
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      {quotationId && <input type="hidden" name="id" value={quotationId} />}

      <div className="grid grid-cols-2 gap-5">
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
          <span className="field-label">Language</span>
          <select
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as DocumentLanguage)}
            className="field-input"
          >
            <option value="EN">English</option>
            <option value="MS">Bahasa Melayu</option>
          </select>
        </label>
      </div>

      <label className="block max-w-xs">
        <span className="field-label">Customer Segment</span>
        <select
          name="customerSegment"
          value={customerSegment}
          onChange={(e) => setCustomerSegment(e.target.value as CustomerSegment)}
          className="field-input"
        >
          {(Object.keys(SEGMENT_LABELS) as CustomerSegment[]).map((segment) => (
            <option key={segment} value={segment}>
              {SEGMENT_LABELS[segment]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-soft">
          Sets the markup applied when picking items from the catalog below.
        </p>
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

      <DocumentLineItemsEditor
        items={items}
        defaultLineItems={defaultLineItems}
        language={language}
        customerSegment={customerSegment}
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

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary">
          Save
        </button>
        {quotationId && (
          <Link href={`/quotations/${quotationId}/preview`} className="link">
            Preview / Generate PDF
          </Link>
        )}
      </div>
    </form>
  );
}
