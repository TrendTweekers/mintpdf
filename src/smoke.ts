/** Minimal end-to-end smoke test: render one markdown PDF and print its size. */
import { markdownToPdf, closeBrowser } from "./pdf.js";

const pdf = await markdownToPdf(
  "# Smoke test\n\nIf you can read this in a PDF, rendering works.\n\n| a | b |\n|---|---|\n| 1 | 2 |",
  { pageNumbers: true, footerText: "pdfmint smoke" },
);
if (pdf.subarray(0, 5).toString() !== "%PDF-") {
  throw new Error("output is not a PDF");
}
console.log(`ok: rendered ${pdf.length} bytes`);
await closeBrowser();
