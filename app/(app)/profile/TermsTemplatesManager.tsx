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
    <div className="panel max-w-xl space-y-4 p-6">
      {templates.length === 0 && (
        <p className="text-sm text-ink-soft">
          No terms templates yet — add one below.
        </p>
      )}

      {templates.map((t) =>
        editingId === t.id ? (
          <form
            key={t.id}
            action={updateTermsTemplate}
            className="space-y-3 border-b border-paper-line pb-4"
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
            className="flex items-start justify-between gap-3 border-b border-paper-line pb-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{t.name}</span>
                {t.isDefault && (
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                    Default
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-sm text-xs text-ink-soft">
                {t.text || "(no text)"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {!t.isDefault && (
                <form action={setDefaultTermsTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="link-ink">
                    Set default
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => setEditingId(t.id)}
                className="link-ink"
              >
                Edit
              </button>
              <form action={deleteTermsTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="btn-danger">
                  Delete
                </button>
              </form>
            </div>
          </div>
        )
      )}

      <form action={createTermsTemplate} className="space-y-3">
        <p className="field-label">Add template</p>
        <label className="block">
          <span className="field-label">Name</span>
          <input type="text" name="name" className="field-input" />
        </label>
        <label className="block">
          <span className="field-label">Text</span>
          <textarea name="text" rows={4} className="field-input" />
        </label>
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>
    </div>
  );
}
