import { setInvoiceDeposit } from "./actions";

// Deposit received/date is metadata, not document content (see setInvoiceDeposit),
// so this form is rendered on both the draft and issued views of an invoice —
// unlike every other invoice field, it's never locked by issuance.
export default function DepositForm({
  invoiceId,
  defaultDepositReceived,
  defaultDepositReceivedAt,
}: {
  invoiceId: string;
  defaultDepositReceived?: string;
  defaultDepositReceivedAt?: string;
}) {
  return (
    <form
      action={setInvoiceDeposit}
      className="max-w-3xl space-y-3 border-t border-border pt-6"
    >
      <input type="hidden" name="id" value={invoiceId} />
      <span className="field-label">Deposit</span>
      <div className="grid grid-cols-2 gap-5">
        <label className="block">
          <span className="field-label">Deposit Received (RM)</span>
          <input
            type="number"
            name="depositReceived"
            step="0.01"
            min="0"
            defaultValue={defaultDepositReceived ?? ""}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Date Received</span>
          <input
            type="date"
            name="depositReceivedAt"
            defaultValue={defaultDepositReceivedAt ?? ""}
            className="field-input"
          />
        </label>
      </div>
      <button type="submit" className="btn-secondary">
        Save Deposit
      </button>
    </form>
  );
}
