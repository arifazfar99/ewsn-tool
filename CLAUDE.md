# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A hosted, single-user web app for a solo proprietor (Malaysia, MYR) to create Quotations, Delivery Orders, and Invoices that chain together (Quotation → Delivery Order → Invoice, strict 1:1:1, client + line items carried forward at conversion), each with an on-screen preview and branded PDF export. Full spec: `project-docs/PRD.md`.

## Versions run newer than your training data — verify before assuming an API

This repo runs **Next.js 16.2.12** and **Prisma 7.9.1**, both of which have real breaking changes versus older releases you may know. Do not pattern-match from memory:

- Next.js: read `node_modules/next/dist/docs/01-app/` (the installed docs) before writing routing/actions/middleware code. Headline changes that bite here: `params`/`searchParams` are always a `Promise` (`await` them) in both pages and route handlers; the root auth-guard file is `proxy.ts` (not `middleware.ts`), exporting a function named `proxy`; `cookies()`/`headers()` are async-only; Turbopack is already the default (no `--turbopack` flag needed).
- Prisma: this project has the vendor's own Claude Code skills installed (`.claude/skills/prisma-*`) — invoke `prisma-cli`, `prisma-database-setup`, `prisma-client-api`, or `prisma-upgrade-v7` rather than guessing v5/v6-era syntax. Headline changes: generator is `provider = "prisma-client"` with an explicit `output` (client lives at `generated/prisma`, gitignored, regenerate with `prisma generate` — never hand-edit it); a driver adapter is required (`@prisma/adapter-pg` + `pg`, see `lib/db.ts`), there is no bare `new PrismaClient()`; connection config lives in `prisma.config.ts`, not in `schema.prisma`'s `datasource` block.

## Commands

```bash
npm run dev             # start dev server (Turbopack, default port 3000)
npm run build            # production build — also the most reliable way to catch route/type errors across the app
npm run start             # run a production build
npm run lint               # eslint
npx tsc --noEmit           # type-check without emitting

npx prisma generate            # regenerate the client after any schema.prisma change
npx prisma migrate dev --name X  # create + apply a migration in dev
npx prisma studio               # visual DB browser
npx prisma db seed              # (re)run prisma/seed.ts — idempotent upsert of the one User + singleton BusinessProfile, reads SEED_EMAIL/SEED_PASSWORD from .env

npx prisma dev --name default --detach   # start the local dev Postgres (no Docker/account needed; this is what DATABASE_URL in .env points at locally)
npx prisma dev ls                         # check/find its status and connection URLs if DATABASE_URL drifts
```

There is no test suite in this repo.

## Architecture

**Route groups**: everything under `app/(app)/` is the authenticated shell (`app/(app)/layout.tsx` renders the nav; the group itself carries `export const dynamic = "force-dynamic"` since every page reads live, per-request DB/session state and must never be statically prerendered). `app/login/`, `app/api/auth/[...nextauth]/`, and `app/api/documents/` sit outside that group. `proxy.ts` at the repo root redirects any unauthenticated request to `/login`, matching everything except `_next` assets and favicon.

**Auth**: `lib/auth.ts` — next-auth v5, one Credentials provider (`prisma.user.findUnique` + `bcrypt.compare` against `passwordHash`), JWT sessions, no DB adapter/sessions table. `proxy.ts` does **not** protect Server Actions (they're POSTs to the page route and a matcher exclusion would silently skip them) — every mutating Server Action re-checks `await auth()` as its first line. Follow this pattern for any new action.

**Prisma client**: `lib/db.ts` is the singleton (driver-adapter instantiation + dev-hot-reload-safe global caching). `Decimal` fields (all money/quantity columns) come back as Prisma `Decimal` objects and are **not** serializable across the Server→Client Component boundary — convert with `.toNumber()` before passing them down or returning from a Server Action.

**Document lifecycle (the core domain model)** — `Quotation`, `DeliveryOrder`, `Invoice` in `prisma/schema.prisma` all share one shape and one rule: a document is freely editable (client, line items, notes, date) while `issuedAt IS NULL`. Clicking "Generate PDF" is the one-way lock: in a single `$transaction` it assigns a sequential number via `lib/numbering.ts` (`nextDocumentNumber`, shared across all three types — per-doc-type-per-year counter in `DocumentCounter`, format `Q-2026-0001` / `DO-2026-0001` / `INV-2026-0001`), sets `issuedAt`, and (for Quotation/Invoice, not DeliveryOrder) advances `status`. After that, content is locked forever; only status transitions and re-downloads are allowed. Each doc type's `actions.ts` (`app/(app)/quotations/actions.ts`, `.../delivery-orders/actions.ts`, `.../invoices/actions.ts`) has a `saveX` (create/update-while-unissued), `issueX` (the lock transaction), and `setXStatus` (an explicit `ALLOWED_TRANSITIONS` map — extend that map, don't ad-hoc a new transition) — copy this three-function shape for any change here. Status semantics differ per type: Quotation issuance moves `DRAFT → SENT`; DeliveryOrder issuance stays `DRAFT` (a DO can be locked/numbered while still "not yet physically delivered" — `DELIVERED` is a separate manual action); Invoice issuance moves `DRAFT → UNPAID`, and `UNPAID ⇄ PAID` afterwards is **not** gated by the lock (it's metadata, not content).

**Conversion chain**: `sourceQuotationId` on `DeliveryOrder` and `sourceDeliveryOrderId` on `Invoice` are both `@unique`, which is what actually enforces the strict 1:1:1 chain — app-level checks (status must be right, no existing linked document) are the first line of defense, the DB constraint is the backstop. Conversion always **copies** line items into fresh rows (new IDs, same `itemId`/description/quantity/price) rather than referencing the source — editing a converted document never mutates its origin.

**PDF rendering**: `lib/pdf/DocumentPdf.tsx` is one `@react-pdf/renderer` component, prop-driven by doc type label/footer, used two ways — client-side live preview via `lib/pdf/PdfViewer.tsx` (`'use client'`, wraps `<PDFViewer>`, only ever loaded through a dynamic `{ ssr: false }` import since it needs browser APIs) on each `[id]/preview/page.tsx`, and server-side via `renderToBuffer` in each `app/api/documents/<type>/[id]/pdf/route.ts` for the actual download. Changing document layout means editing this one component, not three.

**Numbering/money**: line item `lineTotal` is always computed server-side (`quantity * unitPrice`, rounded to 2dp) inside the Server Action — never trust a client-submitted total. No tax/SST anywhere (the business isn't SST-registered); all amounts are MYR.

## Deployment

Hosted on Vercel, DB on Neon Postgres in production (local dev uses `prisma dev`'s embedded Postgres instead — same schema, different `DATABASE_URL`). Production env vars (`DATABASE_URL`, `AUTH_SECRET`) are set via `vercel env add`, not committed. `prisma migrate deploy` (not `migrate dev`) applies schema changes to Neon.
