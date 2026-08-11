# Installing the MintPDF MCP server

Instructions for an AI agent (Cline, Claude, Cursor) setting this up on a user's behalf.

## The short version

There is nothing to build, clone or configure. Add this to the user's MCP settings:

```json
{
  "mcpServers": {
    "mintpdf": {
      "command": "npx",
      "args": ["-y", "mintpdf-mcp"]
    }
  }
}
```

Then restart the client. That is the whole installation.

## What the user needs

**Node 18 or newer**, for `npx`. Nothing else.

**No API key is required.** The server talks to the hosted API at `https://mintpdf.dev`, which allows
10 renders a day per IP with no account. Do not prompt the user for credentials during setup: it will
work immediately without them.

If the user asks for a higher limit, a free key (email only, no card) raises it to 100 a month:

```bash
curl -X POST https://mintpdf.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email":"them@example.com"}'
```

Set it as an environment variable on the server entry:

```json
{
  "mcpServers": {
    "mintpdf": {
      "command": "npx",
      "args": ["-y", "mintpdf-mcp"],
      "env": { "MINTPDF_API_KEY": "pm_…" }
    }
  }
}
```

## Alternative: connect to the hosted endpoint directly

If the client supports remote MCP servers over streamable HTTP, no local process is needed at all:

```
https://mintpdf.dev/mcp
```

Or via `mcp-remote` for clients that only speak stdio:

```json
{
  "mcpServers": {
    "mintpdf": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mintpdf.dev/mcp"]
    }
  }
}
```

## Verifying it works

Ask the model to produce a document, for example:

> "Make me a one-page PDF invoice with a table of three line items."

A successful call returns a download URL valid for one hour. If you want to check without the model,
the same capability over REST:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Test\n\n| A | B |\n|---|---|\n| 1 | 2 |"}' \
  --output test.pdf
```

## The two tools

| Tool | Use it for |
|---|---|
| `generate_pdf` | Markdown or HTML you already have. Provide exactly one of `markdown` or `html`. |
| `pdf_from_url` | A public web page. Private and internal addresses are refused. |

Both accept `pageNumbers`, `headerText`, `footerText`, `format` (A4, Letter, Legal, A3, A5),
`landscape` and `margin`.

## Self-hosting instead

If the user would rather not use the hosted service, the project is MIT licensed with a published
image:

```bash
docker run -p 3000:3000 -e BASE_URL=http://localhost:3000 ghcr.io/trendtweekers/mintpdf:latest
```

Then point `MINTPDF_BASE_URL` at it:

```json
{
  "mcpServers": {
    "mintpdf": {
      "command": "npx",
      "args": ["-y", "mintpdf-mcp"],
      "env": { "MINTPDF_BASE_URL": "http://localhost:3000" }
    }
  }
}
```

## Things that are not problems

- **No signup step.** If you are looking for a registration flow, there isn't one.
- **Rendered files are deleted after an hour.** Download the URL rather than storing it for later.
- **Submitted HTML executes JavaScript**, which is how Mermaid and KaTeX render. Requests to private
  and internal addresses are blocked at two layers.
