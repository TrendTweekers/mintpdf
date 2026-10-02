---
slug: invoice-pdf-html-nodejs
title: Generate invoice PDFs from HTML templates in Node.js
description: A working Node.js invoice template: safe escaping, money in integer cents, print CSS that survives page breaks, then a PDF via Puppeteer or an API.
date: 2026-10-02
---

An invoice is the most common document anyone generates from code, and the one where small mistakes
cost the most. A total that is off by a cent, a customer name that breaks the layout, a table that
splits its last row across two pages. Nobody notices in development. A customer notices on the first
real invoice.

This guide builds a complete invoice in Node.js with no template engine: a data object, a function
that returns HTML, and a call that turns it into a PDF. Every part was rendered and checked, including
a 63-line invoice that runs to three pages.

## Start from data, not from HTML

Keep the invoice as plain data and treat the HTML as a view of it. Store money as **integer cents**:

```js
const invoice = {
  number: "INV-2026-0142",
  issued: "2026-10-02",
  due: "2026-11-01",
  currency: "USD",
  taxRate: 0.08,
  seller: { name: "Northwind Studio LLC", address: ["12 Harbor St", "Portland, OR 97201"] },
  buyer: { name: "Smith & Sons <Hardware>", address: ["400 Main Ave", "Boise, ID 83702"] },
  items: [
    { description: "Website redesign, phase 1", qty: 1, unitCents: 240000 },
    { description: "Hosting, October", qty: 1, unitCents: 4900 },
    { description: "Support hours", qty: 3.5, unitCents: 9500 },
  ],
};
```

The customer name has `&`, `<` and `>` in it on purpose. Real company names contain ampersands, and
any field a user can edit will eventually contain angle brackets.

## Three helpers that prevent the expensive bugs

```js
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const money = (cents, currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

function totals(inv) {
  const lines = inv.items.map((it) => ({ ...it, totalCents: Math.round(it.qty * it.unitCents) }));
  const subtotal = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const tax = Math.round(subtotal * inv.taxRate);
  return { lines, subtotal, tax, total: subtotal + tax };
}
```

**Escape everything you interpolate.** A template literal does not escape anything. Without `esc()`,
`Smith & Sons <Hardware>` prints as `Smith & Sons`. The word `Hardware` is gone, because the
browser reads `<Hardware>` as an unknown tag. If the value came from a user, it is also a way to put HTML and
script into your renderer. That matters more than it seems, because a headless browser that runs
untrusted markup can be used to reach your internal network. See
[Rendering user HTML makes your server an SSRF proxy](/guides/ssrf-headless-browser).

**Do the arithmetic in cents.** Floating point cannot represent most decimal amounts exactly:

```js
0.1 + 0.2;          // 0.30000000000000004
(1.005).toFixed(2); // "1.00", not "1.01"
```

With integer cents, the only rounding is the one you choose. Here it is `Math.round` once per line
and once for the tax. `3.5` hours at `9500` cents gives exactly `33250`. If your tax rules round per
line instead of on the subtotal, change it in `totals()`, not in the template.

**Format with Intl.NumberFormat.** It handles the symbol, the thousands separator and the decimals for
each currency. Change `"en-US"` and the currency code and the same template prints `2.400,00 €`
for a German customer.

## The template

```js
function renderInvoice(inv) {
  const { lines, subtotal, tax, total } = totals(inv);
  const m = (c) => money(c, inv.currency);
  const rows = lines
    .map(
      (l) => `<tr>
        <td>${esc(l.description)}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${m(l.unitCents)}</td>
        <td class="num">${m(l.totalCents)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(inv.number)}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 22mm;
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt sans-serif; color: #888; }
  }
  body { font: 10pt/1.45 system-ui, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; }
  header { display: flex; justify-content: space-between; margin-bottom: 14mm; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  .muted { color: #666; }
  .parties { display: flex; gap: 20mm; margin-bottom: 10mm; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; border-bottom: 1.5px solid #1a1a1a; padding: 6px 4px; font-size: 9pt; }
  td { border-bottom: 1px solid #e3e3e3; padding: 6px 4px; }
  tr { break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-left: auto; width: 45%; margin-top: 6mm; break-inside: avoid; }
  .totals td { border: none; }
  .totals .grand td { border-top: 1.5px solid #1a1a1a; font-weight: 700; font-size: 12pt; }
</style></head>
<body>
  <header>
    <div><h1>Invoice</h1><div class="muted">${esc(inv.number)}</div></div>
    <div class="num">Issued ${esc(inv.issued)}<br>Due ${esc(inv.due)}</div>
  </header>
  <div class="parties">
    <div><strong>From</strong><br>${[inv.seller.name, ...inv.seller.address].map(esc).join("<br>")}</div>
    <div><strong>Bill to</strong><br>${[inv.buyer.name, ...inv.buyer.address].map(esc).join("<br>")}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${m(subtotal)}</td></tr>
    <tr><td>Tax (${(inv.taxRate * 100).toFixed(0)}%)</td><td class="num">${m(tax)}</td></tr>
    <tr class="grand"><td>Total due</td><td class="num">${m(total)}</td></tr>
  </table>
</body></html>`;
}
```

The CSS is short, and each print rule is there for a reason:

- `thead { display: table-header-group }` repeats the column headings on every page of a long
  invoice.
- `tr { break-inside: avoid }` stops a row being cut in half at the page boundary.
- `.totals { break-inside: avoid }` keeps subtotal, tax and total together. A total on its own at
  the top of a page, away from the lines it adds up, is the kind of thing that gets an invoice
  questioned.
- `.num` right-aligns amounts and uses `tabular-nums`, so every digit has the same width and the
  decimal points line up down the column.
- The `@page` rule sets the paper size and margins, and its `@bottom-right` box prints
  "Page 1 of 3" with no footer template. That rule needs Chrome 131 or later. For the older
  `footerTemplate` approach and its traps, see
  [Puppeteer PDF headers and footers with page numbers](/guides/puppeteer-pdf-header-footer).

The system font stack is deliberate. A web font in an invoice is one more thing that can fail
without an error on the server.

## Render it with Puppeteer

```js
import { writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";

// ...invoice, esc, money, totals and renderInvoice from above...

const html = renderInvoice(invoice);
await writeFile("invoice.html", html);

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: `${invoice.number}.pdf`, preferCSSPageSize: true, printBackground: true });
await browser.close();
```

`preferCSSPageSize: true` lets the `@page` rule decide the paper size. Writing `invoice.html` to
disk as well is useful in development, since you can open it in a normal browser and use print
preview to adjust the layout without rendering a PDF each time.

The output is a one-page A4 invoice with a subtotal of $2,781.50, 8% tax of $222.52 and a total due
of $3,004.02. To test pagination I added 60 more lines. The invoice ran to three pages, the column
headings appeared at the top of all three, and subtotal, tax and total stayed together at the end
of page three.

For production, launch the browser once and reuse it across invoices. Starting Chromium takes far
longer than rendering one page.

## Render it without running Chromium

If the invoice is the only reason you run a headless browser, you can send the same HTML to an API
instead. With [MintPDF](/), the rendering step becomes one `fetch`, and the template does not change:

```js
const headers = { "Content-Type": "application/json" };
if (process.env.MINTPDF_KEY) headers.Authorization = `Bearer ${process.env.MINTPDF_KEY}`;

const res = await fetch("https://mintpdf.dev/v1/pdf", {
  method: "POST",
  headers,
  body: JSON.stringify({ html: renderInvoice(invoice), format: "A4" }),
});
if (!res.ok) throw new Error(`PDF render failed: ${res.status} ${await res.text()}`);
await writeFile(`${invoice.number}.pdf`, Buffer.from(await res.arrayBuffer()));
```

It runs Chromium too, so the `@page` rule, the page numbers and the repeating headings work exactly
as above. The PDF it returned was the same layout, page for page. A few renders a day need no key,
and a free key, which asks only for an email, gives 100 a month.

## When HTML is more than you need

For a quick or one-off invoice, a Markdown table is often enough, and MintPDF styles it as a
document:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Invoice INV-2026-0142\n\n| Item | Qty | Amount |\n|:-----|----:|-------:|\n| Website redesign | 1 | $2,400.00 |\n| Support hours | 3.5 | $332.50 |\n\n**Total due: $3,004.02**","pageNumbers":true}' \
  --output invoice.pdf
```

The `$` amounts stay as text. Single dollar signs are not treated as maths, for exactly this reason.
The alignment row (`----:`) right-aligns the amount columns. If your line items already exist as an
export, the [CSV to PDF](/csv-to-pdf) and [JSON to PDF](/json-to-pdf) converters turn them into a
paginated table in the browser, with no code.

When an invoice runs long, the details of how Chromium chooses page breaks matter more. They are
covered in [Headless Chrome splits your PDFs in the wrong places](/guides/chromium-pdf-page-breaks).
