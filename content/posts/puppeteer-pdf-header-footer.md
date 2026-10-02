---
slug: puppeteer-pdf-header-footer
title: Puppeteer PDF headers and footers with page numbers
description: Why Puppeteer's footerTemplate prints tiny text, ignores your CSS and drops images, and the @page rules that give you page numbers without it.
date: 2026-10-02
---

Adding "Page 3 of 7" to a Puppeteer PDF looks like one option. You set `displayHeaderFooter: true`,
pass a `footerTemplate`, and render. Then the footer is either invisible, printed on top of your
text, or there is a date and a page title at the top that you never asked for.

None of that is a bug. The header and footer are a separate little document with its own rules, and
those rules are barely documented. Here is each one, tested against Chrome 148, and a newer CSS
approach that avoids most of them.

## The working version first

```js
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent("<h1>Report</h1><p>Body text.</p>", { waitUntil: "load" });

await page.pdf({
  path: "report.pdf",
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  headerTemplate: "<span></span>",
  footerTemplate: `
    <div style="font-size:9px; color:#888; width:100%; padding:0 15mm; text-align:right;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>`,
});

await browser.close();
```

Every line of that template is there for a reason. Here they are.

## 1. The text is tiny unless you set a font size

Leave `font-size` out and the footer still renders. In my test it came out at **0.75pt**, which is
a smudge you will mistake for a rendering artefact. The template does not inherit any sensible
default, so set the size explicitly on the outer element. `9px` to `10px` reads like a normal
document footer.

## 2. Your page CSS does not reach the template

My test page set `body { font-family: serif; color: red }`. The body text came out red and serif.
The footer came out black, in DejaVu Sans. The template is rendered as its own document, so nothing
from the page's stylesheet applies: not fonts, not colours, not classes.

You can either use inline styles, as above, or put a `<style>` block inside the template itself.
Both work:

```js
footerTemplate: `
  <style>
    .f { font-size: 9px; color: #888; width: 100%; padding: 0 15mm; text-align: right; }
  </style>
  <div class="f"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
```

Only fonts already available to the browser will work here. A web font loaded by the page is not
loaded by the template.

## 3. Without margins, the footer prints over your content

The header and footer do not reserve any space. They are drawn at a fixed position near the page
edge, and the page `margin` is the only thing that keeps your content out of the way. Puppeteer's
default margin is zero.

I rendered a page full of text with `displayHeaderFooter: true` and no margin. The body text ran
from 6pt to 833pt down an 842pt page, straight through both the header and the footer. With
`top` and `bottom` set to `20mm`, the body sat between 62pt and 782pt and the footer had clear
space. If your footer is "missing", check the margin before anything else.

The same applies to horizontal position. The template spans the full page width, which is why the
example adds `padding: 0 15mm` to line the footer up with the left and right margins of the body.

## 4. Pass both templates, even if you only want one

Set only `footerTemplate` and Chrome fills the header with its own default: the date on the left
and the document `<title>` in the middle. My test produced `10/2/26, 8:59 AM` and `My Doc Title`
across the top of every page.

To show nothing, pass an empty element:

```js
headerTemplate: "<span></span>",
```

An empty string does not do the same thing. Use the element.

## 5. The five special classes

Chrome fills these in for you, inside either template:

| Class | Value |
|---|---|
| `pageNumber` | current page number |
| `totalPages` | total number of pages |
| `title` | the document `<title>` |
| `date` | the print date, formatted for the browser locale |
| `url` | the page URL, which is `about:blank` after `setContent` |

That last one catches people out. If you render with `page.setContent()` rather than
`page.goto()`, `url` prints `about:blank`. Put the real value in the template yourself.

## 6. Images need to be data URIs

A logo in the header loaded from a URL does not appear. I tested a PNG served from a local HTTP
server in the header, and the same PNG as a `data:` URI in the footer. Only the data URI made it into
the PDF.

```js
import { readFileSync } from "node:fs";

const logo = readFileSync("logo.png").toString("base64");

const headerTemplate = `
  <div style="font-size:9px; width:100%; padding:0 15mm;">
    <img src="data:image/png;base64,${logo}" style="height:24px">
  </div>`;
```

Keep it small. The image is embedded into the template for every page.

## 7. Background colours need print-color-adjust

A coloured header bar with `background: #0000ff` printed as white. `printBackground: true` on
`page.pdf()` did not change that, because the option applies to the page and not to the template.
What fixed it was one property inside the template:

```css
-webkit-print-color-adjust: exact;
```

With that on the element, the bar printed blue.

## The newer way: @page margin boxes

Chrome 131 added support for CSS page margin boxes. You describe the header and footer in the
page's own stylesheet, and the browser places them in the margin. No `displayHeaderFooter`, no
template, and it uses your page fonts and colours, because it is your page CSS.

```css
@page {
  size: A4;
  margin: 20mm 15mm;
  @top-right     { content: "Quarterly report"; font: 9pt sans-serif; color: #888; }
  @bottom-center { content: "Page " counter(page) " of " counter(pages); font: 9pt sans-serif; color: #888; }
}

/* No running header on the cover page. */
@page :first {
  @top-right { content: none; }
}
```

Render it with `preferCSSPageSize: true` so the `@page` size and margins win:

```js
await page.pdf({ path: "report.pdf", preferCSSPageSize: true, printBackground: true });
```

My three-page test printed "Page 1 of 3" on the cover with no running header, then "Quarterly
report" plus "Page 2 of 3" and "Page 3 of 3" on the pages after it. That `:first` rule is something
the template approach cannot do at all, since the same template is stamped on every page.

The limit: margin boxes hold generated `content`, so they suit text, counters and simple strings.
For a logo or a layout with several elements, the template approach is still the tool.

| You need | Use |
|---|---|
| Page numbers, a title, a confidentiality line | `@page` margin boxes |
| A different first page | `@page` margin boxes |
| A logo or a multi-part layout | `footerTemplate` / `headerTemplate` |
| Support for Chrome older than 131 | `footerTemplate` / `headerTemplate` |

## The same thing without running Chromium

If the page numbers are the only reason you are maintaining a headless browser, an API can do the
template work for you. [MintPDF](/) takes `pageNumbers`, `headerText` and `footerText`, and builds a
template with the font size and margins already handled:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Quarterly report\n\nBody text.","headerText":"Acme Ltd","footerText":"Confidential","pageNumbers":true}' \
  --output report.pdf
```

The footer reads `Confidential` on the left and `1 / 1` on the right. It also accepts raw `html`, and
the `@page` margin box rules above work in it unchanged, because it is Chromium underneath. For a
quick check without code, the [Markdown to PDF converter](/markdown-to-pdf) has a page numbers
switch.

Page numbers are usually the first fix. The second is where the pages break, which is a separate set
of CSS rules covered in [Headless Chrome splits your PDFs in the wrong places](/guides/chromium-pdf-page-breaks).
