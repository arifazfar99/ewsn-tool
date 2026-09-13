"use client";

import { useState } from "react";
import {
  createTermsTemplate,
  updateTermsTemplate,
  deleteTermsTemplate,
  setDefaultTermsTemplate,
} from "./actions";

type Template = {
  id: string;
  name: string;
  text: string;
  isDefault: boolean;
};

export default function TermsTemplatesManager({
  templates,
}: {
  templates: Template[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="panel max-w-2xl">
      <div className="border-b border-border p-5">
        <h2 className="text-sm font-bold text-ink">Quotation Terms Templates</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          Pick one when drafting a Quotation, or write custom terms each time
        </p>
      </div>

      <div className="p-5">
        {templates.length === 0 && (
          <p className="mb-4 text-sm text-ink-soft">
            No terms templates yet — add one below.
          </p>
        )}

        {templates.map((t, i) =>
          editingId === t.id ? (
            <form
              key={t.id}
              action={updateTermsTemplate}
              className={`space-y-3 py-4 ${i > 0 ? "border-t border-border/60" : ""}`}
            >
              <input type="hidden" name="id" value={t.id} />
              <label className="block">
                <span className="field-label">Name</span>
                <input
                  type="text"
                  name="name"
                  defaultValue={t.name}
                  className="field-input"
                />
              </label>
              <label className="block">
                <span className="field-label">Text</span>
                <textarea
                  name="text"
                  defaultValue={t.text}
                  rows={4}
                  className="field-input"
                />
              </label>
              <div className="flex gap-2">
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
              </div>
            </form>
          ) : (
            <div
              key={t.id}
              className={`flex items-start justify-between gap-3 py-3.5 ${
                i > 0 ? "border-t border-border/60" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{t.name}</span>
                  {t.isDefault && (
                    <span className="whitespace-nowrap rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-text">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-0.5 max-w-md truncate text-xs text-ink-soft">
                  {t.text || "(no text)"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {!t.isDefault && (
                  <form action={setDefaultTermsTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="link text-xs">
                      Set default
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => setEditingId(t.id)}
                  className="link text-xs"
                >
                  Edit
                </button>
                <form action={deleteTermsTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-danger/45 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-soft"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          )
        )}

        <form
          action={createTermsTemplate}
          className="mt-2 space-y-3 rounded-md border-[1.5px] border-dashed border-border p-4"
        >
          <label className="block">
            <span className="field-label text-primary/85">+ Add Template</span>
            <input
              type="text"
              name="name"
              placeholder="Template name"
              className="field-input"
            />
          </label>
          <label className="block">
            <span className="field-label">Text</span>
            <textarea name="text" rows={4} className="field-input" />
          </label>
          <button type="submit" className="btn-secondary">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
