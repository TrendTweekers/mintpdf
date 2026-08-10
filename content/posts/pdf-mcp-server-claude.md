---
slug: pdf-mcp-server-claude
title: Let Claude hand you a finished PDF
description: Add one MCP server and your AI agent can turn a conversation into a formatted PDF without you copying Markdown anywhere.
date: 2026-08-09
---

An agent can research a topic, write a clear summary, and then leave you holding Markdown in a chat
window. The document is finished; the last hundred metres are not. You copy the text out, paste it
somewhere that renders, export to PDF, then fix the styling because raw Markdown converts badly.

MCP closes that gap, and PDF generation turns out to be a natural fit: one tool call in, one file out.

## Setup

Add this to your MCP client config (for Claude Desktop, `claude_desktop_config.json`):

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

Restart the client. Two tools appear:

| Tool | Input | Returns |
|---|---|---|
| `generate_pdf` | `html` **or** `markdown`, plus options | download URL, valid one hour |
| `pdf_from_url` | a public `url`, plus options | download URL, valid one hour |

Then ask for what you want in plain language:

> Summarise this thread as a one-page brief, add page numbers, and give me a PDF.

The agent writes the Markdown, calls the tool, and replies with a link. No key is needed for the
first few renders a day.

## Why the output looks right

Agents write Markdown natively. Converting Markdown straight to PDF usually produces something that
reads like a text file: tables with no borders, cramped code blocks, headings indistinguishable from
body text.

MintPDF applies a default stylesheet before rendering, so tables, code blocks, blockquotes and
headings arrive formatted. Neither you nor the agent has to think about design. When you do want
control, send `html` instead of `markdown` and your own CSS is used as-is.

## Options worth knowing

```json
{
  "markdown": "# Q3 Report\n\nRevenue grew 12%.",
  "format": "A4",
  "margin": "20mm",
  "headerText": "Internal draft",
  "footerText": "Acme Ltd",
  "pageNumbers": true
}
```

`format` accepts A4, Letter, Legal, A3, A5. `landscape` flips orientation. `pageNumbers` adds
`3 / 7` to the footer, which is the detail that makes a generated document feel like a real one.

## The honest limits

- **Hosted, not air-gapped.** If documents cannot leave your network, self-host something instead;
  [Gotenberg](https://gotenberg.dev) is free, MIT-licensed, and excellent for that.
- **Free tier**: 10 renders/day anonymously, 100/month with a free key (email, no card). Paid plans start at $19/month for 3,000.
- **Chromium rendering.** Ordinary CSS behaves; advanced paged-media CSS is not its strength.
- **Nothing is kept.** Download links expire after an hour and the file is deleted. That is good for
  privacy and bad if you wanted permanent URLs.

## Without an MCP client

The same capability is a plain HTTP endpoint:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Test\n\nGenerated via API.","pageNumbers":true}' \
  --output test.pdf
```

MintPDF is open source (MIT) at
[github.com/TrendTweekers/mintpdf](https://github.com/TrendTweekers/mintpdf) if you would rather run
your own copy, and it is listed in the official MCP registry as
`io.github.TrendTweekers/mintpdf`.
