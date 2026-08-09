---
slug: chromium-pdf-page-breaks
title: Headless Chrome splits your PDFs in the wrong places
description: Chromium's default fragmentation cuts code blocks, tables and headings in half across page boundaries. The CSS that fixes it, what it costs, and one common rule that silently breaks Markdown tables.
date: 2026-08-09
---

If you generate PDFs with headless Chrome, your output probably has a defect you have not looked for.
Mine did. A sixteen-line code block rendered as `line_0` through `line_9` at the bottom of page one,
then `line_10` onwards at the top of page two. Nothing was lost. It just looked like something a
program produced rather than a document a person would send.

That is Chromium's default fragmentation behaviour. It fills the page, and when it runs out of room
it cuts wherever it happens to be. For a web page that is correct. For a printed document it is the
difference between "generated" and "designed".

Here is what actually fixes it, what it costs, and one rule that quietly breaks Markdown tables while
looking completely reasonable.

## The problem, concretely

Render a long document with a headless browser and you get four recurring defects:

1. **Blocks cut in half.** Code blocks, tables and blockquotes split across the page boundary.
2. **Stranded headings.** A heading lands as the last line of a page, its section starting overleaf.
3. **Orphans and widows.** A single line of a paragraph alone at the top or bottom of a page.
4. **Table headers that appear once.** A table spanning three pages labels its columns only on the first.

None of these are bugs. They are the absence of instructions.

## The stylesheet

```css
/* Keep blocks whole across page boundaries. */
pre, table, blockquote, figure, img { break-inside: avoid; page-break-inside: avoid; }
tr, li                              { break-inside: avoid; page-break-inside: avoid; }

/* Never strand a heading at the foot of a page. */
h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }

/* At least three lines of a paragraph stay together. */
p { orphans: 3; widows: 3; }

/* Repeat the header row when a table continues onto the next page. */
thead { display: table-header-group; }

/* Long lines wrap instead of being clipped at the page edge. */
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
```

Both the modern (`break-inside`) and legacy (`page-break-inside`) properties are there deliberately.
Chromium understands both, and the older one is still what several rendering paths respect.

`thead { display: table-header-group }` is the one people miss. It is not a hack: it is the CSS
mechanism for repeating headers, and it costs one line.

## What it costs

Keeping blocks whole means pages end early when the next block will not fit. My 17-page test document
became 19 pages, about 12% longer.

That is the entire trade: slightly more paper, no sliced content. For invoices, reports and receipts
it is obviously worth it. If you are generating something where page count is contractually fixed,
you will want to be more selective about which elements get `break-inside: avoid`.

One limitation worth stating plainly: a block taller than a page will still split, because it has to.
`break-inside: avoid` is a preference, not a guarantee. It saves the sixteen-line code block; it
cannot save an eighty-line one.

## The rule that broke my tables

This is the part I would not have found by reading advice. My Markdown pipeline had this:

```css
th, td { border: 1px solid #ccc; padding: .45em .7em; text-align: left; }
```

Reasonable-looking. It also silently destroyed every right-aligned column.

Markdown lets you align columns:

```markdown
| Item   | Qty | Price |
|:-------|:---:|------:|
| Widget |  2  |  9.00 |
```

Most Markdown parsers implement that with an HTML attribute. Here is what `marked` emits:

```html
<th align="right">Price</th>
<td align="right">9.00</td>
```

The `align` attribute is a *presentational hint*, and any CSS rule beats it. So `th, td { text-align:
left }` overrode every alignment the author had asked for. Every price column in every invoice was
rendering left-aligned, and nothing in the output looked broken enough to notice.

The fix is specificity, not removal:

```css
th, td                             { text-align: left; }
th[align="center"], td[align="center"] { text-align: center; }
th[align="right"],  td[align="right"]  { text-align: right; }
```

An attribute selector (0,1,1) outranks a bare element selector (0,0,1), so the author's alignment
wins again. If your parser emits `style="text-align:right"` instead, inline styles already beat your
stylesheet and you never had this bug.

## Verify by rendering, not by reading

I nearly shipped the page-break fix without checking it, because the CSS is well known and obviously
correct. The reason I know it works is that I rendered a 40-section document before and after and
looked at the pages.

That is also how I found the table bug, which no amount of reading about page breaks would have
surfaced.

A cheap way to eyeball output without leaving your terminal: render the PDF, then screenshot it in
the same headless browser you generated it with.

```js
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("file:///tmp/test.pdf", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));   // let the built-in viewer paint
await page.screenshot({ path: "/tmp/preview.png", fullPage: true });
await browser.close();
```

Chrome's built-in PDF viewer renders the file, so the screenshot shows real pagination, including the
page boundaries you are trying to fix. Crude, fast, and it catches things a diff never will.

Worth testing specifically:

- A document long enough to paginate, with a code block positioned to straddle a break.
- A table with more rows than fit on one page.
- A table with mixed column alignment.
- Content whose background you did not choose.

That last one deserves a decision rather than a fix. If a caller sends you HTML with
`background: #111`, printing a dark page is *correct*: they asked for it. Forcing white would be you
overriding an author's design. Only style the paths you own, which for me means the Markdown
renderer, not arbitrary HTML input.

## The short version

Four properties (`break-inside`, `break-after`, `orphans`/`widows`, `table-header-group`) turn
browser output into document output, at the cost of about 12% more pages. Then check whether your own
stylesheet is overriding your parser's alignment, because that failure is invisible until someone
looks at a price column and frowns.

---

## Try the stylesheet without writing it

Every rule above ships in MintPDF's Markdown renderer, so you can see the behaviour in about ten
seconds without setting up a browser:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Test\n\n| Item | Price |\n|:-----|------:|\n| Widget | 9.00 |","pageNumbers":true}' \
  --output test.pdf
```

No signup for the first few renders a day. The [full API reference](/) covers the options, and the
renderer is [open source](https://github.com/TrendTweekers/mintpdf) if you would rather read the
stylesheet in context.
