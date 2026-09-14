import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildStages, statusLine, type Stage } from "@/lib/documentStage";
import { invoiceBalanceDue, invoiceUncreditedAmount, invoiceReceiptedAmounts, sumLineItems } from "@/lib/money";
import { saveProjectNotes } from "../actions";
import { issueQuotation, setQuotationStatus } from "../../quotations/actions";
import { createDepositInvoice, setDepositInvoiceReceived } from "../../deposit-invoices/actions";
import {
  convertQuotationToDeliveryOrder,
  issueDeliveryOrder,
  setDeliveryOrderStatus,
} from "../../delivery-orders/actions";
import { convertDeliveryOrderToInvoice, issueInvoice, setInvoiceStatus } from "../../invoices/actions";
import { issueReceiptForDepositInvoice, issueReceiptForInvoice } from "../../receipts/actions";
import DepositForm from "../../invoices/DepositForm";
import QuotationCostsManager from "../../quotations/QuotationCostsManager";

const STAGE_TONE: Record<Stage["state"], string> = {
  done: "bg-primary text-white",
  active: "bg-primary-soft text-primary ring-1 ring-inset ring-primary",
  negative: "bg-danger-soft text-danger",
  upcoming: "bg-surface-muted text-ink-soft",
};

function ChevronTimeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex gap-0.5">
      {stages.map((stage, i) => (
        <div
          key={stage.label}
          className={`relative flex-1 min-w-[110px] py-2.5 pr-4 text-xs font-semibold [clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,14px_50%)] first:pl-4 first:[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%)] ${
            i === 0 ? "pl-4" : "pl-[26px]"
          } ${STAGE_TONE[stage.state]}`}
        >
          <span className="block">{stage.label}</span>
          {stage.sub && <span className="mt-0.5 block text-[11px] font-normal opacity-85">{stage.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function money(n: number) {
  return `RM ${n.toFixed(2)}`;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      quotation: {
        include: {
          lineItems: true,
          costs: { orderBy: { sortOrder: "asc" } },
          depositInvoice: { include: { receipt: true } },
          deliveryOrder: {
            include: {
              lineItems: true,
              invoice: {
                include: {
                  lineItems: true,
                  receipts: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const q = project.quotation;
  const depositInvoice = q?.depositInvoice ?? null;
  const deliveryOrder = q?.deliveryOrder ?? null;
  const invoice = deliveryOrder?.invoice ?? null;
  const receipts = invoice?.receipts ?? [];
  // Delta since the last receipt - how much of what's been received hasn't
  // been receipted yet. Drives the Issue Receipt button's visibility and
  // amount; an invoice can now have several receipts over its life, one per
  // payment installment, so "a receipt exists" no longer means "settled".
  const uncreditedAmount = invoice
    ? invoiceUncreditedAmount(
        invoice.depositReceived,
        invoiceReceiptedAmounts(receipts, depositInvoice?.receipt?.amount)
      )
    : 0;

  const stages = q
    ? buildStages({
        quotation: { status: q.status, acceptedAt: q.acceptedAt },
        deliveryOrder: deliveryOrder
          ? {
              status: deliveryOrder.status,
              deliveredAt: deliveryOrder.deliveredAt,
              hasInvoice: invoice != null,
            }
          : null,
        invoice: invoice
          ? {
              status: invoice.status,
              paidAt: invoice.paidAt,
            }
          : null,
        receipt:
          receipts.length > 0
            ? {
                count: receipts.length,
                latestIssuedAt: receipts.at(-1)?.issuedAt ?? null,
                remaining: uncreditedAmount,
              }
            : null,
      })
    : null;

  // Same resolution DocumentStageTracker used - a hand-typed depositReceived
  // on the Invoice always wins once it exists (it may have been corrected
  // there), otherwise fall back to the DepositInvoice once it's been marked
  // received.
  const depositAmount =
    invoice?.depositReceived != null
      ? invoice.depositReceived.toNumber()
      : depositInvoice?.receivedAt != null
        ? depositInvoice.amount.toNumber()
        : null;

  const isPaidInFull = invoice?.status === "PAID";

  const activeTotal = invoice
    ? sumLineItems(invoice.lineItems)
    : deliveryOrder
      ? sumLineItems(deliveryOrder.lineItems)
      : q
        ? sumLineItems(q.lineItems)
        : 0;

  // Nets against the same resolved depositAmount shown in the top bar's
  // Deposit figure (not invoice.depositReceived alone) so the two numbers
  // never disagree - depositAmount already falls back to the DepositInvoice
  // when the Invoice hasn't had a deposit carried onto it directly.
  const balanceDue =
    invoice && invoice.status === "UNPAID"
      ? invoiceBalanceDue(invoice.lineItems, invoice.discountAmount, depositAmount)
      : null;

  return (
    <div className="max-w-4xl">
      {error && <p className="alert-danger mb-4">{error}</p>}

      {/* Top bar */}
      <div className="panel mb-5 flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <Link href="/projects" className="link mb-1.5 block text-xs">
            &larr; Projects
          </Link>
          <h1 className="page-title">{project.title ?? project.client.name}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{project.client.name}</p>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          {activeTotal > 0 && (
            <div className="text-right">
              <p className="eyebrow">Total</p>
              <p className="font-mono text-lg font-semibold">{money(activeTotal)}</p>
            </div>
          )}
          {(isPaidInFull || depositAmount != null) && (
            <div className="text-right">
              <p className="eyebrow">{isPaidInFull ? "Paid" : "Deposit"}</p>
              <p className="font-mono text-lg font-semibold text-success">
                {money(isPaidInFull ? activeTotal : (depositAmount as number))}
              </p>
            </div>
          )}
          {balanceDue != null && (
            <div className="text-right">
              <p className="eyebrow">Balance Due</p>
              <p className="font-mono text-lg font-semibold text-danger">{money(balanceDue)}</p>
            </div>
          )}
        </div>
      </div>

      {stages && (
        <div className="mb-5">
          <ChevronTimeline stages={stages} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* Discussion notes */}
          <div className="panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Discussion Notes</h2>
            <form action={saveProjectNotes} className="space-y-3">
              <input type="hidden" name="id" value={project.id} />
              <input
                type="text"
                name="title"
                defaultValue={project.title ?? ""}
                placeholder="Project title"
                className="field-input"
              />
              <textarea
                name="notes"
                defaultValue={project.notes ?? ""}
                rows={4}
                placeholder="What's this job about?"
                className="field-input"
              />
              <div className="flex justify-end">
                <button type="submit" className="btn-secondary">
                  Save
                </button>
              </div>
            </form>
          </div>

          {/* Line items */}
          <div className="panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Line Items</h2>
            {q ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice?.lineItems ?? deliveryOrder?.lineItems ?? q.lineItems).map((line) => (
                      <tr key={line.id}>
                        <td>{line.description}</td>
                        <td className="num">
                          {line.unit ? `${line.quantity.toNumber()} ${line.unit}` : line.quantity.toNumber()}
                        </td>
                        <td className="num">{money(line.unitPrice.toNumber())}</td>
                        <td className="num">{money(line.lineTotal.toNumber())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No quotation yet - line items appear once one is started.</p>
            )}
          </div>

          {q?.issuedAt && (
            <QuotationCostsManager
              quotationId={q.id}
              costs={q.costs.map((c) => ({ id: c.id, label: c.label, amount: c.amount.toNumber() }))}
              totalSales={sumLineItems(q.lineItems)}
            />
          )}
        </div>

        <div className="space-y-5">
          {/* Current-stage actions */}
          <div className="rounded-md border border-primary/20 bg-primary-soft p-5">
            <p className="mb-3 text-sm font-semibold text-primary">
              {stages ? statusLine(stages) : "No quotation yet - still scoping the job."}
            </p>

            {!q && (
              <Link href={`/quotations/new?projectId=${project.id}`} className="btn-primary">
                Start Quotation
              </Link>
            )}

            {q && !q.issuedAt && (
              <div className="flex flex-wrap gap-2">
                <Link href={`/quotations/${q.id}`} className="btn-secondary">
                  Edit Quotation
                </Link>
                <form action={issueQuotation}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" className="btn-primary">
                    Issue Quotation
                  </button>
                </form>
              </div>
            )}

            {q?.issuedAt && q.status === "SENT" && (
              <form action={setQuotationStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={q.id} />
                <button type="submit" name="status" value="ACCEPTED" className="btn-primary">
                  Accept
                </button>
                <button type="submit" name="status" value="REJECTED" className="btn-secondary">
                  Reject
                </button>
                <button type="submit" name="status" value="EXPIRED" className="btn-secondary">
                  Mark Expired
                </button>
                <button type="submit" name="status" value="VOIDED" className="btn-danger">
                  Void
                </button>
              </form>
            )}

            {q?.issuedAt && (q.status === "REJECTED" || q.status === "EXPIRED") && (
              <form action={setQuotationStatus}>
                <input type="hidden" name="id" value={q.id} />
                <button type="submit" name="status" value="VOIDED" className="btn-danger">
                  Void
                </button>
              </form>
            )}

            {q?.status === "ACCEPTED" && !deliveryOrder && (
              <div className="flex flex-wrap gap-2">
                <form action={convertQuotationToDeliveryOrder}>
                  <input type="hidden" name="quotationId" value={q.id} />
                  <button type="submit" className="btn-primary">
                    Convert to Delivery Order
                  </button>
                </form>
                <form action={setQuotationStatus}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" name="status" value="VOIDED" className="btn-danger">
                    Void
                  </button>
                </form>
              </div>
            )}

            {q?.status === "ACCEPTED" && !depositInvoice && (
              <form action={createDepositInvoice} className="mt-4 max-w-xs border-t border-primary/20 pt-4">
                <input type="hidden" name="quotationId" value={q.id} />
                <label className="block">
                  <span className="eyebrow text-primary/75">Deposit Amount (RM)</span>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    defaultValue={(activeTotal * 0.5).toFixed(2)}
                    className="field-input mt-1"
                  />
                </label>
                <button type="submit" className="btn-secondary mt-3">
                  Create Deposit Invoice
                </button>
              </form>
            )}

            {depositInvoice && !depositInvoice.receivedAt && (
              <form
                action={setDepositInvoiceReceived}
                className="mt-4 flex flex-wrap items-end gap-3 border-t border-primary/20 pt-4"
              >
                <input type="hidden" name="id" value={depositInvoice.id} />
                <p className="w-full text-sm text-primary">
                  Deposit Invoice {depositInvoice.number ?? "DRAFT"} - {money(depositInvoice.amount.toNumber())}
                </p>
                <label className="block">
                  <span className="eyebrow text-primary/75">Date Received</span>
                  <input
                    type="date"
                    name="receivedAt"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="field-input mt-1"
                  />
                </label>
                <button type="submit" className="btn-secondary">
                  Mark Deposit Received
                </button>
              </form>
            )}

            {deliveryOrder && !deliveryOrder.issuedAt && (
              <div className="flex flex-wrap gap-2">
                <Link href={`/delivery-orders/${deliveryOrder.id}`} className="btn-secondary">
                  Edit Delivery Order
                </Link>
                <form action={issueDeliveryOrder}>
                  <input type="hidden" name="id" value={deliveryOrder.id} />
                  <button type="submit" className="btn-primary">
                    Issue Delivery Order
                  </button>
                </form>
              </div>
            )}

            {deliveryOrder?.issuedAt && deliveryOrder.status !== "VOIDED" && !invoice && (
              <div className="flex flex-wrap gap-2">
                {deliveryOrder.status === "DRAFT" && (
                  <form action={setDeliveryOrderStatus}>
                    <input type="hidden" name="id" value={deliveryOrder.id} />
                    <button type="submit" name="status" value="DELIVERED" className="btn-secondary">
                      Mark Delivered
                    </button>
                  </form>
                )}
                <form action={convertDeliveryOrderToInvoice}>
                  <input type="hidden" name="deliveryOrderId" value={deliveryOrder.id} />
                  <button type="submit" className="btn-primary">
                    Convert to Invoice
                  </button>
                </form>
                <form action={setDeliveryOrderStatus}>
                  <input type="hidden" name="id" value={deliveryOrder.id} />
                  <button type="submit" name="status" value="VOIDED" className="btn-danger">
                    Void
                  </button>
                </form>
              </div>
            )}

            {invoice && !invoice.issuedAt && (
              <div className="flex flex-wrap gap-2">
                <Link href={`/invoices/${invoice.id}`} className="btn-secondary">
                  Edit Invoice
                </Link>
                <form action={issueInvoice}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <button type="submit" className="btn-primary">
                    Issue Invoice
                  </button>
                </form>
              </div>
            )}

            {invoice?.issuedAt && !(invoice.status === "PAID" && uncreditedAmount <= 0) && (
              <div>
                <div className="flex flex-wrap gap-2">
                  {invoice.status === "UNPAID" && (
                    <form action={setInvoiceStatus}>
                      <input type="hidden" name="id" value={invoice.id} />
                      <button type="submit" name="status" value="PAID" className="btn-primary">
                        Mark Paid
                      </button>
                    </form>
                  )}
                  {invoice.status === "PAID" && (
                    <form action={setInvoiceStatus}>
                      <input type="hidden" name="id" value={invoice.id} />
                      <button type="submit" name="status" value="UNPAID" className="btn-secondary">
                        Mark Unpaid
                      </button>
                    </form>
                  )}
                  {uncreditedAmount > 0 && (
                    <form action={issueReceiptForInvoice}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <button type="submit" className="btn-primary">
                        Issue Receipt ({money(uncreditedAmount)})
                      </button>
                    </form>
                  )}
                  <form action={setInvoiceStatus}>
                    <input type="hidden" name="id" value={invoice.id} />
                    <button type="submit" name="status" value="VOIDED" className="btn-danger">
                      Void
                    </button>
                  </form>
                </div>
                <div className="mt-4 border-t border-primary/20 pt-1">
                  {receipts.length > 0 && (
                    <p className="mb-2 text-xs text-ink-soft">
                      {receipts.length} receipt{receipts.length === 1 ? "" : "s"} issued so far
                      {uncreditedAmount > 0
                        ? ` - ${money(uncreditedAmount)} received but not yet receipted`
                        : uncreditedAmount < 0
                          ? ` - ${money(Math.abs(uncreditedAmount))} more receipted than recorded as received - check the deposit figure`
                          : " - fully credited"}
                      .
                    </p>
                  )}
                  <DepositForm
                    invoiceId={invoice.id}
                    defaultDepositReceived={invoice.depositReceived?.toNumber().toString() ?? ""}
                    defaultDepositReceivedAt={
                      invoice.depositReceivedAt ? invoice.depositReceivedAt.toISOString().slice(0, 10) : ""
                    }
                  />
                  <p className="mt-1.5 text-xs text-ink-soft">
                    Enter the running total received to date, not just this payment.
                  </p>
                </div>
              </div>
            )}

            {/* Once an Invoice exists, that same received-but-unreceipted deposit
                money is already tracked (and receiptable) through the
                Invoice's own Issue Receipt button above - offering this one
                too would let both be clicked for the same payment. */}
            {depositInvoice?.receivedAt && !depositInvoice.receipt && !invoice && (
              <form action={issueReceiptForDepositInvoice} className="mt-4 border-t border-primary/20 pt-4">
                <input type="hidden" name="depositInvoiceId" value={depositInvoice.id} />
                <button type="submit" className="btn-secondary">
                  Issue Deposit Receipt
                </button>
              </form>
            )}
          </div>

          {/* Documents */}
          <div className="panel p-5">
            <h2 className="mb-1 text-sm font-semibold">Documents</h2>
            {!q ? (
              <p className="text-sm text-ink-soft">Nothing issued yet.</p>
            ) : (
              <div>
                {q.issuedAt && (
                  <DocRow
                    name={`Quotation ${q.number}`}
                    meta={`Issued ${q.issuedAt.toLocaleDateString("en-MY")}`}
                    href={`/api/documents/quotation/${q.id}/pdf`}
                  />
                )}
                {depositInvoice && (
                  <DocRow
                    name={`Deposit Invoice ${depositInvoice.number ?? "DRAFT"}`}
                    meta={
                      depositInvoice.receivedAt
                        ? `Received ${depositInvoice.receivedAt.toLocaleDateString("en-MY")}`
                        : "Awaiting payment"
                    }
                    href={`/api/documents/deposit-invoice/${depositInvoice.id}/pdf`}
                  />
                )}
                {deliveryOrder?.issuedAt && (
                  <DocRow
                    name={`Delivery Order ${deliveryOrder.number}`}
                    meta={`Issued ${deliveryOrder.issuedAt.toLocaleDateString("en-MY")}`}
                    href={`/api/documents/delivery-order/${deliveryOrder.id}/pdf`}
                  />
                )}
                {invoice?.issuedAt && (
                  <DocRow
                    name={`Invoice ${invoice.number}`}
                    meta={`Issued ${invoice.issuedAt.toLocaleDateString("en-MY")}`}
                    href={`/api/documents/invoice/${invoice.id}/pdf`}
                  />
                )}
                {receipts.map((r) => (
                  <DocRow
                    key={r.id}
                    name={`Receipt ${r.number ?? "DRAFT"} (${money(r.amount.toNumber())})`}
                    meta={r.issuedAt ? `Issued ${r.issuedAt.toLocaleDateString("en-MY")}` : ""}
                    href={`/api/documents/receipt/${r.id}/pdf`}
                  />
                ))}
                {depositInvoice?.receipt && (
                  <DocRow
                    name={`Receipt (deposit) ${depositInvoice.receipt.number ?? "DRAFT"}`}
                    meta={
                      depositInvoice.receipt.issuedAt
                        ? `Issued ${depositInvoice.receipt.issuedAt.toLocaleDateString("en-MY")}`
                        : ""
                    }
                    href={`/api/documents/receipt/${depositInvoice.receipt.id}/pdf`}
                  />
                )}
              </div>
            )}
          </div>

          {/* Client contact */}
          <div className="panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Client Contact</h2>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {project.client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{project.client.contactPerson ?? project.client.name}</p>
                {project.client.phone && <p className="text-xs text-ink-soft">{project.client.phone}</p>}
                {project.client.email && <p className="text-xs text-ink-soft">{project.client.email}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocRow({ name, meta, href }: { name: string; meta: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        {meta && <p className="text-xs text-ink-soft">{meta}</p>}
      </div>
      <a href={href} className="btn-secondary py-1.5 text-xs">
        Download
      </a>
    </div>
  );
}
