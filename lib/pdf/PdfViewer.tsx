"use client";

import { PDFViewer } from "@react-pdf/renderer";
import DocumentPdf, { type DocumentPdfProps } from "./DocumentPdf";

// Actual PDFViewer usage (renders an iframe) — browser-only. Loaded via
// next/dynamic({ ssr: false }) from PdfPreviewClient, never imported directly
// into a Server Component tree.
export default function PdfViewer(props: DocumentPdfProps) {
  return (
    <PDFViewer width="100%" height={900} showToolbar>
      <DocumentPdf {...props} />
    </PDFViewer>
  );
}
