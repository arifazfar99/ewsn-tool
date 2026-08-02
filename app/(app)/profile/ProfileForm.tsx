"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileFormState } from "./actions";

type Profile = {
  logoDataUrl: string | null;
  name: string;
  address: string;
  phone: string;
  email: string;
  bankDetailsText: string;
  quotationTerms: string;
};

const initialState: ProfileFormState = {};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState
  );
  const [logoDataUrl, setLogoDataUrl] = useState(profile.logoDataUrl ?? "");

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="panel max-w-xl space-y-5 p-6">
      {state.error && (
        <p className="stamp stamp-negative !block !text-left">
          {state.error}
        </p>
      )}

      <input type="hidden" name="logoDataUrl" value={logoDataUrl} />

      <div>
        <label className="field-label">Logo</label>
        {logoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUrl}
            alt="Business logo"
            className="mb-2 h-16 w-auto rounded-sm border border-paper-line object-contain"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="block text-sm text-ink-soft"
        />
      </div>

      <label className="block">
        <span className="field-label">Name</span>
        <input
          type="text"
          name="name"
          defaultValue={profile.name}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">Address</span>
        <textarea
          name="address"
          defaultValue={profile.address}
          rows={3}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">Phone</span>
        <input
          type="text"
          name="phone"
          defaultValue={profile.phone}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">Email</span>
        <input
          type="email"
          name="email"
          defaultValue={profile.email}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">
          Bank details (shown on invoices)
        </span>
        <textarea
          name="bankDetailsText"
          defaultValue={profile.bankDetailsText}
          rows={4}
          className="field-input"
        />
      </label>

      <label className="block">
        <span className="field-label">
          Quotation terms (shown on quotations)
        </span>
        <textarea
          name="quotationTerms"
          defaultValue={profile.quotationTerms}
          rows={4}
          className="field-input"
        />
      </label>

      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
