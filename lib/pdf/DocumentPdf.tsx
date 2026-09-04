import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import {
  type DocumentLanguage,
  getChromeLabels,
  translateDocTypeLabel,
  translateFooterLabel,
  dateLocale,
} from "./labels";

export type DocumentPdfProps = {
  docTypeLabel: string; // "QUOTATION" | "DELIVERY ORDER" | "INVOICE"
  number: string | null; // null = still a draft, show "DRAFT" instead
  date: Date;
  language?: DocumentLanguage; // optional, defaults to "EN"
  business: {
    name: string;
    ssmNumber: string;
    address: string;
    phone: string;
    email: string;
    logoDataUrl: string | null;
  };
  client: {
    name: string;
    address: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
  };
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  title?: string | null;
  notes: string | null;
  footerLabel: string | null;
  footerText: string | null;
  total: number;
  discountLabel?: string | null;
  discountAmount?: number | null;
  depositReceived?: number | null;
  depositReceivedAt?: Date | string | null;
  showThankYou?: boolean; // Invoice/Receipt only - a payment context, unlike Quotation/DO/DepositInvoice
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 12,
    color: "#18181b",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  logo: {
    height: 48,
    marginBottom: 6,
    objectFit: "contain",
  },
  businessName: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 2,
  },
  muted: {
    color: "#52525b",
  },
  docLabel: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 4,
  },
  docMeta: {
    textAlign: "right",
    color: "#52525b",
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#71717a",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  table: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  tableHeaderRow: {
    backgroundColor: "#f4f4f5",
    fontWeight: 700,
  },
  colDescription: {
    flex: 3,
    padding: 6,
  },
  colQty: {
    flex: 1,
    padding: 6,
    textAlign: "right",
  },
  colUnitPrice: {
    flex: 1,
    padding: 6,
    textAlign: "right",
  },
  colLineTotal: {
    flex: 1,
    padding: 6,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totalRowTight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  totalLabel: {
    fontWeight: 700,
    marginRight: 12,
  },
  totalValue: {
    fontWeight: 700,
  },
  discountReason: {
    textAlign: "right",
    fontSize: 10,
    marginBottom: 6,
  },
  notesText: {
    color: "#3f3f46",
  },
  subjectText: {
    marginBottom: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#71717a",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  footerText: {
    color: "#3f3f46",
  },
  noteContainer: {
    marginTop: 24,
  },
  thankYouNote: {
    fontSize: 11,
    fontWeight: 700,
    color: "#3f3f46",
    textAlign: "center",
    marginBottom: 4,
  },
  generatedNote: {
    fontSize: 9,
    color: "#a1a1aa",
    textAlign: "center",
  },
});

function money(value: number): string {
  return `RM ${value.toFixed(2)}`;
}

function formatDate(date: Date, language: DocumentLanguage): string {
  return date.toLocaleDateString(dateLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DocumentPdf({
  docTypeLabel,
  number,
  date,
  language = "EN",
  business,
  client,
  lineItems,
  title,
  notes,
  footerLabel,
  footerText,
  total,
  discountLabel,
  discountAmount,
  depositReceived,
  depositReceivedAt,
  showThankYou,
}: DocumentPdfProps) {
  const hasDiscount = discountAmount != null;
  const labels = getChromeLabels(language);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {business.logoDataUrl && (
              // react-pdf's <Image>, not an HTML <img> — no alt attribute in its API.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.logo} src={business.logoDataUrl} />
            )}
            <Text style={styles.businessName}>{business.name}</Text>
            {business.ssmNumber && (
              <Text style={styles.muted}>{labels.ssmNo} {business.ssmNumber}</Text>
            )}
            <Text style={styles.muted}>{business.address}</Text>
            <Text style={styles.muted}>{business.phone}</Text>
            <Text style={styles.muted}>{business.email}</Text>
          </View>
          <View>
            <Text style={styles.docLabel}>{translateDocTypeLabel(docTypeLabel, language)}</Text>
            <Text style={styles.docMeta}>{number ?? labels.draft}</Text>
            <Text style={styles.docMeta}>{formatDate(date, language)}</Text>
          </View>
        </View>

        {title && <Text style={styles.subjectText}>{title}</Text>}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{labels.billTo}</Text>
          <Text>{client.name}</Text>
          <Text style={styles.muted}>{client.address}</Text>
          {client.contactPerson && (
            <Text style={styles.muted}>{labels.attn} {client.contactPerson}</Text>
          )}
          {client.phone && <Text style={styles.muted}>{client.phone}</Text>}
          {client.email && <Text style={styles.muted}>{client.email}</Text>}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={styles.colDescription}>{labels.description}</Text>
            <Text style={styles.colQty}>{labels.qty}</Text>
            <Text style={styles.colUnitPrice}>{labels.unitPrice}</Text>
            <Text style={styles.colLineTotal}>{labels.lineTotal}</Text>
          </View>
          {lineItems.map((line, i) => (
            <View
              key={i}
              style={i === lineItems.length - 1 ? { flexDirection: "row" } : styles.tableRow}
            >
              <Text style={styles.colDescription}>{line.description}</Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colUnitPrice}>{money(line.unitPrice)}</Text>
              <Text style={styles.colLineTotal}>{money(line.lineTotal)}</Text>
            </View>
          ))}
        </View>

        {!hasDiscount && depositReceived == null ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{labels.total}</Text>
            <Text style={styles.totalValue}>{money(total)}</Text>
          </View>
        ) : (
          <>
            <View style={styles.totalRowTight}>
              <Text style={styles.totalLabel}>{labels.subtotal}</Text>
              <Text>{money(total)}</Text>
            </View>
            {hasDiscount && (
              <>
                <View style={styles.totalRowTight}>
                  <Text style={styles.totalLabel}>{labels.discount}</Text>
                  <Text>-{money(discountAmount)}</Text>
                </View>
                {discountLabel && (
                  <Text style={[styles.muted, styles.discountReason]}>
                    {discountLabel}
                  </Text>
                )}
              </>
            )}
            {depositReceived != null && (
              <View style={styles.totalRowTight}>
                <Text style={styles.totalLabel}>
                  {labels.lessDeposit}
                  {depositReceivedAt
                    ? ` (${formatDate(new Date(depositReceivedAt), language)})`
                    : ""}
                </Text>
                <Text>{money(depositReceived)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {depositReceived != null ? labels.balanceDue : labels.total}
              </Text>
              <Text style={styles.totalValue}>
                {money(total - (discountAmount ?? 0) - (depositReceived ?? 0))}
              </Text>
            </View>
          </>
        )}

        {notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{labels.notes}</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}

        {footerText && (
          <View style={styles.section}>
            <Text style={styles.footerLabel}>
              {translateFooterLabel(footerLabel ?? "Terms & Conditions", language)}
            </Text>
            <Text style={styles.footerText}>{footerText}</Text>
          </View>
        )}

        <View style={styles.noteContainer}>
          {showThankYou && (
            <Text style={styles.thankYouNote}>{labels.thankYou}</Text>
          )}
          <Text style={styles.generatedNote}>{labels.generatedNote}</Text>
        </View>
      </Page>
    </Document>
  );
}
