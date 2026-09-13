"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileFormState } from "./actions";
import { useCapturedOccurrence } from "@/lib/useCapturedOccurrence";
import Toast from "@/components/Toast";

type Profile = {
  logoDataUrl: string | null;
  name: string;
  ssmNumber: string;
  address: string;
  phone: string;
  email: string;
  bankDetailsText: string;
};

const initialState: ProfileFormState = {};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState
  );
  const [logoDataUrl, setLogoDataUrl] = useState(profile.logoDataUrl ?? "");

  // `state` is a fresh object reference every time an action completes (even
  // for back-to-back saves with identical field values), so a distinct
  // reference is itself enough to count as a new occurrence here — unlike
  // SuccessToast's URL-param case, there's no recurring string value that
  // needs its "seen" tracking reset in between.
  const savedOccurrence = useCapturedOccurrence(state.success ? state : null);

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
    <form action={formAction} className="panel max-w-2xl">
      <div className="border-b border-border p-5">
        <h2 className="text-sm font-bold text-ink">Business Identity</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          Shown on every Quotation, Delivery Order, Invoice, and Receipt PDF
        </p>
      </div>

      <div className="space-y-4 p-5">
        {state.error && <p className="alert-danger">{state.error}</p>}

        <input type="hidden" name="logoDataUrl" value={logoDataUrl} />

        <div className="flex items-start gap-4">
          <div>
            <label className="flex h-[84px] w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-md border-[1.5px] border-dashed border-border bg-surface-muted">
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoDataUrl}
                  alt="Business logo"
                  className="h-full w-full object-contain p-1.5"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-6 w-6 text-ink-soft"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
            <p className="mt-1.5 text-center text-[11px] font-semibold text-primary">
              {logoDataUrl ? "Change logo" : "Upload logo"}
            </p>
          </div>

          <div className="grid flex-1 grid-cols-[2fr_1fr] gap-3.5">
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
              <span className="field-label">SSM Number</span>
              <input
                type="text"
                name="ssmNumber"
                defaultValue={profile.ssmNumber}
                className="field-input"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="field-label">Address</span>
          <textarea
            name="address"
            defaultValue={profile.address}
            rows={3}
            className="field-input"
          />
        </label>

        <div className="grid grid-cols-2 gap-3.5">
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
        </div>

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

        <div className="flex justify-end border-t border-border pt-4">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {savedOccurrence && (
        <Toast key={savedOccurrence.nonce} message="Profile saved" />
      )}
    </form>
  );
}
