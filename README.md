<div align="center">

<img src="https://raw.githubusercontent.com/TrendTweekers/mintpdf/main/public/mark.svg" width="64" alt="MintPDF">

# MintPDF

**HTML &amp; Markdown → PDF, as a REST API and an MCP server.**

No template editor. No template IDs. No dashboard. No signup to try.

**[mintpdf.dev](https://mintpdf.dev)**

[Try it](#quickstart) · [MCP setup](#use-it-from-claude-or-any-mcp-client) · [API](#api) · [Self-host](#self-host)

</div>

---

Agents write Markdown. People need documents. MintPDF is the missing step: send HTML or Markdown,
get a clean PDF back, from your code or straight from an AI agent via MCP.

- **MCP native** — `generate_pdf` and `pdf_from_url` over streamable HTTP. Claude can render a
  document mid-conversation.
- **Markdown looks right by default** — tables, code blocks, blockquotes and headings come out
  styled, so agent-written documents don't look like a text file.
- **No templates** — your code or your agent already produced the content; skip the template step.
- **Nothing is kept** — generated files auto-delete after one hour, no document storage, no account
  needed to try it.

## Quickstart

No signup, no key:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Invoice #42\n\n| Item | Price |\n|---|---|\n| Widget | $9.00 |","pageNumbers":true}' \
  --output invoice.pdf
```

Want more than 10 renders a day? A free key (email only, no card) raises it to 100 a month:

```bash
curl -X POST https://mintpdf.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
# → {"key":"pm_…","daily_limit":100}   # 100 renders per month
```

Then send `Authorization: Bearer pm_…` with your requests.

## Use it from Claude (or any MCP client)

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

Prefer the hosted endpoint directly? Use `mcp-remote` instead:

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

Restart your client, then just ask:

> "Summarise this thread as a one-page brief with page numbers and give me a PDF."

| Tool | Input | Returns |
|---|---|---|
| `generate_pdf` | `html` **or** `markdown`, plus options | download URL, valid 1 hour |
| `pdf_from_url` | `url` (public http/https), plus options | download URL, valid 1 hour |

## API

### `POST /v1/pdf`

Body takes **exactly one** source, plus options:

| Field | Type | Notes |
|---|---|---|
| `html` | string | Full document or fragment |
| `markdown` | string | Rendered with the default stylesheet |
| `url` | string | Public page to render. Private/internal addresses are blocked |
| `format` | string | `A4` (default), `Letter`, `Legal`, `A3`, `A5` |
| `landscape` | boolean | default `false` |
| `margin` | string | all sides, e.g. `"18mm"` |
| `headerText` / `footerText` | string | small text on every page |
| `pageNumbers` | boolean | adds `3 / 7` to the footer |
| `output` | `"pdf"` \| `"url"` | default returns PDF bytes; `"url"` returns JSON with a link |

### `POST /v1/keys`

`{"email":"you@example.com"}` → a free key. No card, no verification loop.

### `POST /mcp`

MCP streamable-HTTP endpoint, stateless. Same capabilities as the REST API.

## Limits

| Tier | Limit | Price |
|---|---|---|
| Anonymous | 10 renders/day per IP | free, no signup |
| Free key | 100 renders/month | free, email only |
| Solo | 3,000 renders/month | $19/month |
| Team | 12,000 renders/month | $49/month |
| Scale | 50,000 renders/month | $129/month |

## Self-host

MintPDF is MIT-licensed; run your own if you'd rather.

```bash
npm install
npm run build
npm start                # http://localhost:3000
node dist/smoke.js       # end-to-end render check
```

Or pull the published image, which has Chromium and the fonts baked in:

```bash
docker run -p 3000:3000 \
  -e BASE_URL=http://localhost:3000 \
  -e DATA_DIR=/data -v mintpdf-data:/data \
  ghcr.io/trendtweekers/mintpdf:latest
```

Then it is the same API on your own machine, with no limits and nothing leaving it:

```bash
curl -X POST http://localhost:3000/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Local","pageNumbers":true}' --output local.pdf
```

Images are built and published by CI on every change, and each is smoke-tested by starting the
container and rendering a real PDF from it before being tagged. Tags are `latest` and the short
commit SHA. Building it yourself works too:

```bash
docker build -t mintpdf .
docker run -p 3000:3000 -e BASE_URL=http://localhost:3000 mintpdf
```

Environment: `BASE_URL` (used in download links), `DATA_DIR` (defaults to `/tmp/mintpdf`; mount a
volume to persist keys), `ANON_DAILY_LIMIT`, `FREE_MONTHLY_LIMIT`, `SOLO_MONTHLY_LIMIT`,
`TEAM_MONTHLY_LIMIT`, `SCALE_MONTHLY_LIMIT`, `OVERAGE_FACTOR`.

If you want a fuller self-hosted PDF toolchain (Office formats, merging, splitting),
[Gotenberg](https://gotenberg.dev) is excellent and does more than this does.

## How it works

TypeScript, Fastify, Puppeteer driving one shared Chromium (page per request), `node:sqlite` for keys
and quotas so there are no native dependencies. Requests to private and internal addresses are blocked
both at URL validation and at Chromium's request layer, so embedded resources can't reach them either.

## Licence

MIT — see [LICENSE](LICENSE).
