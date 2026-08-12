# Postman MCP catalog submission

Working notes and the exact copy used. Postman's MCP catalog is a curated list
(`curatedInList`), not a submission queue. Two lists exist: `MCP Servers` for verified
publishers, and `Community MCP Servers`, which contains ordinary unverified accounts.
Submission is by email to api-network@postman.com. There is no fee.

Constraints found by testing, not by reading:

- MCP requests cannot be saved into an existing ordinary collection. Postman forces a new
  MCP-native collection.
- The public Postman API cannot see or create MCP collections. It silently strips MCP
  request fields on write and omits MCP collections from `GET /collections`. Everything
  MCP has to be done in the app.

## Collection summary (one line)

MCP server that turns Markdown or HTML into a styled PDF, or renders any public URL to PDF.

## Collection description

MintPDF turns Markdown or HTML into a styled PDF, or renders any public web page to PDF, and returns a download link.

**Two tools**

- `generate_pdf` takes `markdown` or `html`, exactly one of them. Options cover page size, margins, landscape, header and footer text, and page numbers.
- `pdf_from_url` takes a public `url`. Private and internal addresses are refused.

**What it is for**

Agents produce Markdown constantly and people need documents: invoices, reports, summaries, contracts. This closes that gap with no template editor and no document store. Content in, finished PDF out.

The work is in the print CSS. Tables and code blocks are not sliced across page breaks, table headers repeat on every page, and headings are not stranded at the foot of a page. Text stays selectable, unlike screenshot based converters.

**Getting started**

Remote, nothing to install: connect to `https://mintpdf.dev/mcp` over streamable HTTP. That is the "Remote" request in this collection.

Local: run `npx -y mintpdf-mcp`. That is the "STDIO" request. It needs Node 18 or newer.

**Authentication**

None is required. The anonymous tier allows 10 renders a day per IP, so both requests in this collection work immediately with no key.

A free key raises the limit to 100 a month:

```
curl -X POST https://mintpdf.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

Set it as `MINTPDF_API_KEY` for the local server, or send `Authorization: Bearer pm_...` to the remote endpoint.

**Notes**

Rendered files are deleted after one hour and document content is not logged. The project is MIT licensed with a published container image, so it can be self hosted: `ghcr.io/trendtweekers/mintpdf`.

## Workspace summary (one line, workspace Overview)

Hosted API and MCP server that turn Markdown or HTML into styled PDFs.

## Workspace README

MintPDF renders Markdown, HTML or any public web page into a PDF and returns a download link.

There are two ways to use it and this workspace documents both:

- **MintPDF — HTML & Markdown to PDF API** is the REST API. `POST /v1/pdf` with `markdown` or `html`, get a PDF back.
- **MintPDF MCP Server** is the same capability exposed over the Model Context Protocol, so an AI agent can produce documents directly. It works remotely at `https://mintpdf.dev/mcp` or locally with `npx -y mintpdf-mcp`.

No key is needed to try either one. The anonymous tier allows 10 renders a day per IP, and a free key raises it to 100 a month.

The interesting part is the print CSS. Tables and code blocks are not sliced across page breaks, table headers repeat on every page, and headings are not stranded at the foot of a page. Text stays selectable rather than rasterised.

MIT licensed, container image published, so it can be self hosted end to end.

## Submission email

To: api-network@postman.com
Subject: MCP server submission: MintPDF (Markdown and HTML to PDF)

Hello,

I would like to submit an MCP server for inclusion in the Postman MCP catalog.

Collection: https://www.postman.com/mintpdf-api-team/mintpdf/collection/6a7c29e0035c0b048c8834cb
Workspace: https://www.postman.com/mintpdf-api-team/mintpdf
Site: https://mintpdf.dev

MintPDF turns Markdown or HTML into a styled PDF, or renders any public web page to PDF, and returns a download link. It exposes two tools, `generate_pdf` and `pdf_from_url`.

The collection contains both transports, and both work without any credentials:

- Remote, streamable HTTP at `https://mintpdf.dev/mcp`. Connecting in Postman loads both tools with their schemas.
- Local, STDIO via `npx -y mintpdf-mcp`, published on npm as `mintpdf-mcp`.

The anonymous tier allows 10 renders a day per IP, so a reviewer can run either request immediately with no signup. It is also in the official MCP registry as `io.github.TrendTweekers/mintpdf`, MIT licensed, with a published container image for self hosting.

Happy to provide anything else you need.

Peter
