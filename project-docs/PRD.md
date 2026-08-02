# PRD — EWSN Document Tool (Quotation / Delivery Order / Invoice Generator)

**Client:** Solo proprietor, Malaysia (MYR), not SST-registered
**Status:** Draft for architect handoff
**Prepared:** 2026-07-31

---

## Project

A hosted web app, private to a single business owner, for creating Quotations,
Delivery Orders, and Invoices that are linked in a conversion chain (Quotation
→ Delivery Order → Invoice), branded with the owner's business identity,
stored in a cloud database, and exportable to PDF after an on-screen preview.

---

## Core user flows

1. Owner logs in with a single-user account (email/password or equivalent) → lands on a dashboard.
2. Owner sets up their **business profile** once (logo, business name, address, phone, email) — this appears on every generated document.
3. Owner adds/edits/lists **clients** (name, address, contact person, phone, email).
4. Owner adds/edits/lists **catalog items/products** (name, description, default unit price, unit) for reuse across documents.
5. Owner creates a **Quotation**: picks a client, adds line items (from catalog and/or typed ad-hoc), sets date/notes → sees an **on-screen preview** matching the final PDF layout → **generates/downloads PDF**.
6. Owner marks a Quotation as **Accepted**, then **converts it into a Delivery Order** — client info and line items carry forward automatically instead of re-entry; owner can adjust quantities/items before finalizing the DO.
7. Owner **converts a Delivery Order into an Invoice** — client info and line items carry forward the same way.
8. Owner marks an Invoice as **Paid** or **Unpaid** (manual status toggle only — no payment gateway involved).
9. Owner browses a **history list** of all Quotations/DOs/Invoices, filterable by client/status/date, and can reopen any past document to view its preview or re-download its PDF.
10. Owner can view the "chain" for a given transaction — which Quotation produced which DO produced which Invoice.

---

## Data model (rough)

```
BusinessProfile (singleton, one row — the owner's own business)
  - logo, name, address, phone, email

User (the single owner account)
  - email, password/auth credential
  (no roles table needed — one user, one privilege level)

Client
  - name, address, contact person, phone, email
  - has many Quotations, DeliveryOrders, Invoices

Item (catalog/product)
  - name, description, default unit price, unit
  - optional: a document line item may reference an Item OR be entered ad-hoc
    (no catalog record) — see Open Question #9

Quotation
  - number (sequential, see Open Question #1)
  - date, client_id, notes
  - status: draft / sent / accepted / rejected / expired  (see Open Question #3)
  - has many QuotationLineItems
  - has zero-or-one converted DeliveryOrder (see Open Question #2 on cardinality)

DeliveryOrder
  - number (sequential)
  - date, client_id, notes
  - status: draft / delivered
  - source_quotation_id (nullable — a DO can exist without a prior Quotation)
  - has many DeliveryOrderLineItems
  - has zero-or-one converted Invoice (see Open Question #2)

Invoice
  - number (sequential)
  - date, client_id, notes
  - status: draft / sent / paid / unpaid
  - source_delivery_order_id (nullable — an Invoice can exist without a prior DO)
  - has many InvoiceLineItems

{Quotation,DeliveryOrder,Invoice}LineItem
  - item_id (nullable, references Item if chosen from catalog)
  - description, quantity, unit_price, line_total
  - (no tax field — out of scope, see below)
```

Note: line items are copied at conversion time, not shared by reference —
editing a Delivery Order's items should not retroactively change the
Quotation it came from. Flagged as an assumption (Open Question #4).

---

## User roles

- **Owner** — the only user. Full access to everything: business profile, clients, catalog, all documents. No client-facing login, no staff accounts, no permission tiers.

---

## Functional requirements: PDF & preview

- **On-screen preview**: after filling in a document's client/line items/date via a normal edit form, the owner sees a read-only rendered view that visually matches the final PDF (same layout, branding, totals) before committing to export. This is a review step, not a WYSIWYG canvas editor — edits happen in the form, not directly on the rendered preview.
- **Generate PDF**: produces a downloadable PDF file from the previewed document, including logo, business details, client details, line items, totals, document number, and date. The generated PDF is retrievable again later from document history (either regenerated on demand or stored — implementation detail for the architect).
- Totals = sum of line item (quantity × unit price). No tax/discount computation.

---

## Explicit constraints

- Hosted web app, accessible from anywhere via browser.
- Cloud database — clients, items, and all documents persist centrally (not local-only).
- Single-user login only; app is private to the owner, not multi-tenant.
- Currency: MYR. No tax/SST line or computation anywhere.
- Documents must be linkable/convertible: Quotation → Delivery Order → Invoice, carrying client + line items forward without manual re-entry.
- Every generated document must show business branding: logo, business name, address, contact details.
- No technology stack constraints from the client — stack choice is deferred to the architect phase; optimize for the simplest stack that satisfies the above (minimal moving parts, no infra beyond what's needed for a hosted app + cloud DB + PDF generation).

---

## Out of scope (do not build)

- **Tax/SST computation or tax line items** — owner is not SST-registered.
- **Multi-user or team accounts / roles / permissions** — single owner only.
- **Multi-tenant architecture** — this is one business's private tool, not a SaaS product for multiple businesses.
- **Payment processing / online payment collection** (e.g. FPX, card gateway) — Invoice "paid/unpaid" is a manual status toggle only, not a real payment integration.
- **Recurring/subscription billing.**
- **Multi-currency support** — MYR only.
- **Inventory/stock tracking** — the Item catalog exists only to speed up line-item entry (name/description/price reuse), not to track stock levels, reorder points, or warehouse quantities.
- **Native mobile apps** — web app only.

---

## Open questions

1. **Document numbering format** — I've assumed sequential numbering per document type (e.g. Q-0001, DO-0001, INV-0001) is required, since it's standard for invoicing and the client's notes imply distinct document identities. This was **not explicitly requested**, so please confirm: numbering scheme (continuous vs. reset yearly), prefix format, and starting number. This is cheap to build either way but the format should be locked before go-live to avoid renumbering old documents.

2. **Conversion cardinality** — Can a single Quotation be converted into multiple partial Delivery Orders (e.g. staggered delivery), and can a single Delivery Order produce multiple partial Invoices (e.g. progress billing)? Or is the chain strictly 1 Quotation → 1 DO → 1 Invoice? This materially changes the data model (one-to-one vs. one-to-many links) and is exactly the kind of thing that's expensive to retrofit later.

3. **Status lifecycle detail** — What statuses does the owner actually need to see/set per document type? For example: does a Quotation need to auto-expire after a validity period, or is "expired" just manual? Does an Invoice need a "partially paid" state, or is it strictly paid/unpaid as a binary? Please confirm the exact status list per document type before the architect finalizes the schema.

4. **Does editing a converted document affect its source?** — I've assumed line items are *copied* at conversion time (editing the DO's quantities does not change the original Quotation). Please confirm this matches your expectation, since the alternative (live-linked items) is a different and more complex design.

5. **Can issued documents be edited or deleted after PDF generation?** — Common practice is to lock a document once it's been sent to a client and offer a "void/cancel" status instead of allowing edits or deletion, to preserve a clean audit trail and matching numbering sequence. Please confirm whether locking is required or if free editing after generation is acceptable.

6. **PDF layout / existing template to match** — Do you currently use an existing Quotation/DO/Invoice template (Word, Excel, or from a previous system) that the new PDFs should visually resemble, or is a clean generic layout acceptable? This affects design time, not architecture, but is worth locking early.

7. **Payment/bank details on the Invoice** — Since there's no online payment collection, invoices typically still need a footer with bank account details or payment instructions so the client knows how to pay. This wasn't mentioned in your notes — do you want a static "payment instructions" text block (e.g. bank name/account number) printed on Invoices, and possibly Terms & Conditions text on Quotations?

8. **Ad-hoc line items** — Can the owner type a one-off line item directly on a document without first saving it to the Item catalog, or should every line item be required to come from the catalog? I've assumed ad-hoc entry is allowed (catalog is a convenience, not a requirement) — please confirm.

---

## Assumptions flagged for confirmation before build starts

- Sequential numbering per document type is included (Open Question #1) even though not explicitly requested, because it's a near-universal requirement for business documents in Malaysia and costly to bolt on retroactively once real documents exist.
- Line items are copied (not live-linked) across the conversion chain (Open Question #4).
- Invoice "paid/unpaid" is a manual owner-set status with no payment gateway involved.
