---
name: generate-pdf
description: Turn HTML or Markdown into a styled PDF, or render a public web page to PDF, and get a download link.
---

# Generate a PDF with MintPDF

Use this when a user needs a finished document rather than text: an invoice, a receipt, a report,
a summary they will send to someone else.

## Fastest path (no key, no signup)

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Invoice #42\n\n| Item | Price |\n|---|---|\n| Widget | $9.00 |","pageNumbers":true}' \
  --output invoice.pdf
```

Add `"output":"url"` to get JSON with a download link (valid one hour) instead of raw bytes.

## As an MCP server

Remote: `https://mintpdf.dev/mcp` (streamable HTTP)
Local: `npx -y mintpdf-mcp`

Tools: `generate_pdf` (html **or** markdown in) and `pdf_from_url` (public URL in).

## Options

`format` (A4, Letter, Legal, A3, A5), `landscape`, `margin` (e.g. "18mm"), `headerText`,
`footerText`, `pageNumbers`.

## Choosing the input

- **markdown** — the default choice. A clean stylesheet is applied automatically, so tables, code
  blocks and headings come out looking right with no design work.
- **html** — when you need full control. Your own CSS is used as-is.
- **url** — to capture a public page as it renders.

## Limits

10 renders/day anonymously, 100/month with a free key (`POST /v1/keys` with an email, no card),
then 3,000/month on Solo ($19), 12,000 on Team ($49) and 50,000 on Scale ($129). Send the key as
`Authorization: Bearer pm_…`.

## Privacy

Generated files are deleted after one hour. No document storage. Requests to private or internal
network addresses are refused.
