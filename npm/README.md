# mintpdf-mcp

MCP server that turns **HTML or Markdown into a styled PDF**, or renders a public URL to PDF, and
returns a download link. Markdown ships with a clean default stylesheet, so agent-written documents
look right without any design work.

Home: **[mintpdf.dev](https://mintpdf.dev)**

## Install

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

Restart your MCP client, then ask for a document:

> Summarise this thread as a one-page brief with page numbers and give me a PDF.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `generate_pdf` | `html` **or** `markdown`, plus options | download URL, valid one hour |
| `pdf_from_url` | public `url`, plus options | download URL, valid one hour |

Options: `format` (A4, Letter, Legal, A3, A5), `landscape`, `margin`, `headerText`, `footerText`,
`pageNumbers`.

## Limits and keys

Works with no key at all for a few renders a day. A free key (email only, no card) raises it to 100
a month:

```bash
curl -X POST https://mintpdf.dev/v1/keys \
  -H "Content-Type: application/json" -d '{"email":"you@example.com"}'
```

Then set it in your MCP config:

```json
"env": { "MINTPDF_API_KEY": "pm_..." }
```

## Self-hosting

Point the package at your own instance with `MINTPDF_BASE_URL`. The server itself is MIT-licensed
and self-hostable: https://github.com/TrendTweekers/mintpdf

## Privacy

Generated files are deleted after one hour. No document storage, no account required.
