"use client";

import dynamic from "next/dynamic";
import type { DocumentPdfProps } from "@/lib/pdf/DocumentPdf";

// react-pdf's PDFViewer needs browser APIs (renders into an iframe), so it
// can't be part of the server-rendered HTML.
const PdfViewer = dynamic(() => import("@/lib/pdf/PdfViewer"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-ink-soft">Loading preview...</p>
  ),
});

export default function PreviewClient(props: DocumentPdfProps) {
  return <PdfViewer {...props} />;
}
