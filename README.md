# PDFMint

HTML & Markdown → PDF API with a native MCP server, built for AI agents and developers who don't
want a template editor.

Working name; final brand/domain TBD.

## What it does

- `POST /v1/pdf` — body has exactly one of `html`, `markdown`, `url`, plus options
  (`format`, `landscape`, `margin`, `headerText`, `footerText`, `pageNumbers`, `output: "url"`).
  Returns the PDF bytes, or `{download_url, expires_at}` when `output` is `"url"`.
- `POST /v1/keys` — `{email}` → free API key (rate limits: anonymous 5/day/IP, keyed 100/day).
- `POST /mcp` — MCP streamable-HTTP endpoint exposing `generate_pdf` and `pdf_from_url`.
- `GET /f/:id` — download a generated PDF (1-hour TTL).

Markdown rendering ships a clean default stylesheet (tables, code blocks, blockquotes) so
agent-generated documents look right with zero design input.

## Run locally

```bash
npm install        # downloads Chromium via puppeteer (~170MB)
npm run build
npm start          # http://localhost:3000
node dist/smoke.js # end-to-end render check
```

## Deploy (Railway)

Deploys from the Dockerfile. Set:

- `BASE_URL` — public URL of the service (used in download links)
- `DATA_DIR` — optional; attach a volume at `/data` if you want keys/usage to survive restarts
- `ANON_DAILY_LIMIT`, `KEY_DAILY_LIMIT` — optional overrides

Chromium runs with `--no-sandbox` inside the container; requests to private/internal addresses are
blocked at the request-interception layer (SSRF guard in `src/ssrf.ts`).

## Design notes

- Node 22.5+ (uses built-in `node:sqlite`; no native deps).
- One shared Chromium instance, page-per-request; stateless MCP transport per the spec.
- Generated files live in `DATA_DIR/files` with a 1-hour TTL sweep.
