export type DocumentLanguage = "EN" | "MS";

// Draft Bahasa Melayu wording - Atlas's best-effort translation, not
// verified formal/government terminology. Review before use on a real
// government tender submission (see Project Resources/project-plan.md
// Phase 73's manual verification step).
const CHROME: Record<DocumentLanguage, Record<string, string>> = {
  EN: {
    billTo: "Bill To",
    attn: "Attn:",
    ssmNo: "SSM No:",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit Price",
    lineTotal: "Line Total",
    notes: "Notes",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    lessDeposit: "Less: Deposit Received",
    balanceDue: "Balance Due",
    thankYou: "Thank you for your business!",
    generatedNote:
      "This is a computer-generated document and does not require a signature.",
    draft: "DRAFT",
  },
  MS: {
    billTo: "Kepada",
    attn: "U.P.:",
    ssmNo: "No. SSM:",
    description: "Perihalan",
    qty: "Kuantiti",
    unitPrice: "Harga Seunit",
    lineTotal: "Jumlah",
    notes: "Nota",
    total: "Jumlah",
    subtotal: "Jumlah Kecil",
    discount: "Diskaun",
    lessDeposit: "Tolak: Deposit Diterima",
    balanceDue: "Baki Perlu Dibayar",
    thankYou: "Terima kasih atas sokongan anda!",
    generatedNote:
      "Ini adalah dokumen janaan komputer dan tidak memerlukan tandatangan.",
    draft: "DRAF",
  },
};

const DOC_TYPE_LABELS: Record<DocumentLanguage, Record<string, string>> = {
  EN: {
    QUOTATION: "QUOTATION",
    "DELIVERY ORDER": "DELIVERY ORDER",
    INVOICE: "INVOICE",
    "DEPOSIT INVOICE": "DEPOSIT INVOICE",
    RECEIPT: "RECEIPT",
  },
  MS: {
    QUOTATION: "SEBUT HARGA",
    "DELIVERY ORDER": "ORDER PENGHANTARAN",
    INVOICE: "INVOIS",
    "DEPOSIT INVOICE": "INVOIS DEPOSIT",
    RECEIPT: "RESIT",
  },
};

const FOOTER_LABELS: Record<DocumentLanguage, Record<string, string>> = {
  EN: {
    "Terms & Conditions": "Terms & Conditions",
    "Bank Details": "Bank Details",
  },
  MS: {
    "Terms & Conditions": "Terma & Syarat",
    "Bank Details": "Butiran Bank",
  },
};

export function getChromeLabels(language: DocumentLanguage) {
  return CHROME[language];
}

export function translateDocTypeLabel(
  docTypeLabel: string,
  language: DocumentLanguage
): string {
  return DOC_TYPE_LABELS[language][docTypeLabel] ?? docTypeLabel;
}

export function translateFooterLabel(
  footerLabel: string,
  language: DocumentLanguage
): string {
  return FOOTER_LABELS[language][footerLabel] ?? footerLabel;
}

export function dateLocale(language: DocumentLanguage): string {
  return language === "MS" ? "ms-MY" : "en-MY";
}
