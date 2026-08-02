# EWSN Document Tool

A hosted, single-user web app for creating Quotations, Delivery Orders, and Invoices that chain together (Quotation → Delivery Order → Invoice, strict 1:1:1, client + line items carried forward at conversion), each with an on-screen preview and branded PDF export.

Built for a solo proprietor in Malaysia (MYR) to replace a manual Excel-based quoting process. No tax/SST computation anywhere — the business isn't SST-registered. Full product spec: [`project-docs/PRD.md`](./project-docs/PRD.md).

## How it works

1. Log in (single account) and set up the **business profile** once — logo, name, address, contact details, bank details, quotation terms. This appears on every generated document.
2. Maintain a **Client** list and an **Item** catalog (reusable name/unit/default price for line items).
3. Create a **Quotation** for a client, add line items, preview it, then **Generate PDF** — this assigns a sequential number (`Q-2026-0001`, editable before issuance to match a pre-existing numbering sequence) and locks the content permanently.
4. Once a Quotation is **Accepted**, **convert it to a Delivery Order** — client and line items copy forward (not live-linked; editing the DO never changes the source Quotation).
5. Once a Delivery Order is issued, **convert it to an Invoice** the same way.
6. Track status per document type (Quotation: Sent/Accepted/Rejected/Expired/Voided; Delivery Order: Delivered/Voided; Invoice: Unpaid/Paid/Voided) and revisit any past document to view or re-download its PDF.

## Tech stack

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **Prisma 7** with a driver adapter (`@prisma/adapter-pg`) against PostgreSQL
- **next-auth v5** (Credentials provider, JWT sessions, no DB session adapter)
- **@react-pdf/renderer** for both the live on-screen preview and the downloaded PDF, from one shared component
- **Tailwind CSS 4**
- Hosted on **Vercel**, database on **Neon Postgres** in production (local dev uses Prisma's own embedded `prisma dev` Postgres)

## Project structure

```
app/(app)/          Authenticated app shell (nav + all pages) — force-dynamic, every page reads live DB state
  clients/, items/     CRUD for clients and the item catalog
  quotations/           Quotation form, detail, preview + PDF issuance
  delivery-orders/      Delivery Order form, detail, preview + PDF issuance
  invoices/              Invoice form, detail, preview + PDF issuance
  profile/                Business profile (logo, contact, bank details, terms)
  dashboard/              Stats + recent documents across all three types
app/login/           Login page (outside the authenticated shell)
app/api/auth/        next-auth route handler
app/api/documents/   PDF download routes (one per doc type)
lib/auth.ts          next-auth config
lib/db.ts            Prisma client singleton (driver adapter)
lib/numbering.ts     Sequential per-doc-type-per-year numbering
lib/pdf/             Shared react-pdf document component + browser preview wrapper
components/          Shared UI (status stamps, etc.)
prisma/              Schema, migrations, seed script
proxy.ts             Auth guard (redirects unauthenticated requests to /login)
project-docs/PRD.md  Full product spec
```

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local dev Postgres (no Docker or account needed):
   ```bash
   npx prisma dev --name default --detach
   ```
   If `DATABASE_URL` in `.env` ever stops matching (the port can drift between restarts), run `npx prisma dev ls` to get the current connection string.
3. Create `.env` with:
   ```
   DATABASE_URL="postgres://..."   # from step 2
   AUTH_SECRET="<a random secret>"
   SEED_EMAIL="owner@example.com"
   SEED_PASSWORD="<a password>"
   ```
4. Apply migrations and seed the one user account + singleton business profile:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```
5. Run the dev server:
   ```bash
   npm run dev
   ```

## Commands

```bash
npm run dev              # start dev server (Turbopack, default port 3000)
npm run build             # production build
npm run start               # run a production build
npm run lint                 # eslint
npx tsc --noEmit              # type-check without emitting

npx prisma generate             # regenerate the client after any schema.prisma change
npx prisma migrate dev --name X   # create + apply a migration in dev
npx prisma studio                  # visual DB browser
npx prisma db seed                  # (re)run prisma/seed.ts (idempotent)
```

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes and Next.js 16 / Prisma 7 API gotchas relevant when modifying this codebase.

## Deployment

Hosted on Vercel; `prisma migrate deploy` (not `migrate dev`) applies schema changes to the production Neon database. `DATABASE_URL` and `AUTH_SECRET` are set via `vercel env add`, not committed.
