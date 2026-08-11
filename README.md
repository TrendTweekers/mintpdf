<div align="center">

<img src="https://raw.githubusercontent.com/TrendTweekers/mintpdf/main/public/mark.svg" width="64" alt="MintPDF">

# MintPDF

**HTML &amp; Markdown → PDF, as a REST API and an MCP server.**

No template editor. No template IDs. No dashboard. No signup to try.

**[mintpdf.dev](https://mintpdf.dev)**

[Try it](#quickstart) · [MCP setup](#use-it-from-claude-or-any-mcp-client) · [API](#api) · [Self-host](#self-host) · [Security](#security) · [Limitations](#limitations)

</div>

---

Send HTML or Markdown, get a PDF back. It is Chromium under the hood, with the print CSS already
worked out so tables don't split across pages, table headers repeat, and Markdown comes out looking
like a document rather than a text file.

- **Pagination is the point.** `break-inside`, repeating `thead`, orphans and widows, and headers
  and footers that actually inherit your styling. See [How it works](#how-it-works).
- **MCP native** — `generate_pdf` and `pdf_from_url` over streamable HTTP, so an agent can produce a
  document mid-conversation.
- **Documents aren't kept** — rendered files are deleted after an hour, and their contents are
  never logged. Keys, emails and usage counters obviously are stored. See [Security](#security).
- **Run it yourself** — MIT, with a published image. The hosted service exists so you don't have to
  operate Chromium, not because the renderer is secret.

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

### Postman

A ready-made collection covering every endpoint and option lives in
[`postman/`](postman/mintpdf.postman_collection.json). Import it by link:

```
https://raw.githubusercontent.com/TrendTweekers/mintpdf/main/postman/mintpdf.postman_collection.json
```

The first request runs with no key at all, and fetching a free key stores it into the collection
variable automatically, so the rest of the collection works straight after.

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
`TEAM_MONTHLY_LIMIT`, `SCALE_MONTHLY_LIMIT`, `OVERAGE_FACTOR`, `RENDER_CONCURRENCY`,
`RENDER_QUEUE`, `RENDER_QUEUE_WAIT_MS`.

### Load and admission control

Every render is a Chromium tab, so **memory bounds concurrency long before CPU or cost does**.
Unbounded, a traffic spike opens a tab per request until the OOM reaper kills the container and
every request fails, including ones nearly finished. Measured here: 30 concurrent renders with no
gate left 30 orphaned Chrome processes and an unusable machine.

`RENDER_CONCURRENCY` renders run at once, `RENDER_QUEUE` more may wait, and anything beyond that is
refused immediately with **503 and a `Retry-After`** rather than being allowed to pile up. Turning
some callers away in under a second is strictly better than serving everyone a timeout.

Code defaults are conservative (3 and 20). Measured on one small Railway instance at 10 and 70:

| Burst | Served | Refused | Median | Wall clock | Instance after |
|---|---|---|---|---|---|
| 45 | 45 | 0 | 1.5s | 2.3s | healthy |
| 120 | 81 | 39 | 3.0s | 4.0s | healthy |
| 250 | 80 | 170 | 3.4s | 4.4s | healthy, 0.24s homepage |

Roughly 18 renders a second sustained, with the refused share answered in under 2.7s. Raise the
numbers only against a measurement on your own instance size, never on hope.

If you want a fuller self-hosted PDF toolchain (Office formats, merging, splitting),
[Gotenberg](https://gotenberg.dev) is excellent and does more than this does.

## Security

This service renders HTML and URLs supplied by anyone, so the interesting questions are about what
that content can reach.

**Submitted HTML executes JavaScript.** It has to: Mermaid diagrams and KaTeX maths are rendered in
the page. Treat the renderer as running untrusted code, which is why the network restrictions below
matter more than they would for a static converter.

**SSRF is blocked at two layers.**

1. A submitted `url` is parsed, restricted to `http`/`https`, and resolved. If *any* resolved address
   is private, the request is refused with a 400 before a browser is involved.
2. Independently, every request Chromium makes is intercepted and the destination **resolved again at
   request time**, then blocked if private. This covers embedded images, stylesheets, fonts,
   redirects and `fetch()` from submitted JavaScript, not just the URL you asked for.

The second layer resolves rather than trusting the hostname, and **caches only refusals, never
approvals**: caching "this host is public" would reopen the exact hole the check exists to close.
Unresolvable names fail closed.

Being precise about what that does and does not achieve: a DNS-rebinding attempt can no longer wait
out a cached approval, so it has to win a race between this lookup and Chromium's own, on every
request. That is a much narrower target than a fixed window, but it is a narrowed race rather than a
closed door. Eliminating it entirely means pinning the resolved address at the socket layer, which
is not implemented.

Blocked: loopback, `0.0.0.0`, RFC1918, CGNAT (100.64/10), link-local and cloud metadata
(169.254.169.254); IPv6 loopback, unspecified, link-local, site-local, unique-local, multicast,
NAT64 and Teredo; **IPv4-mapped and IPv4-compatible forms in either spelling**, so `::ffff:10.0.0.1`
and `::ffff:a00:1` are the same address and both are refused; `localhost`/`.local`/`.internal`
names; any public hostname that resolves to a private address; and every scheme except http, https,
data and blob.

Addresses are judged from their bytes rather than by matching text, because the same address has
many spellings and a text match catches one and misses the rest.

There is a test suite for exactly this, and it is meant to be run rather than trusted:

```bash
BASE=https://mintpdf.dev node scratchpad/ssrf_suite.mjs
```

It checks the bypasses above *and* that ordinary rendering still works, because a guard that also
blocks web fonts is a different bug rather than a fix.

**Download links** use a `crypto.randomUUID()` identifier and are **not authenticated**: anyone with
the link can fetch the file for the hour it exists. That is deliberate, so a link can be emailed or
handed to a browser, but it means the link is the secret.

**Logging.** Request metadata is logged (method, path, status, duration). **Request bodies are never
logged**, so the HTML and Markdown you send are not written anywhere except the temporary file. The
analytics table stores event kind, path, referrer, country and a daily-salted hash of the IP. No
document content, and no way to reconstruct a document from it.

## Limitations

Worth knowing before you build on it.

- **Files are deleted after one hour.** There is no document library and no way to fetch a render
  again later. Generate, use, done. If you need permanence, save the bytes on your side.
- **No Office formats, merging or splitting.** This converts HTML, Markdown and web pages, and
  nothing else. [Gotenberg](https://gotenberg.dev) is more mature and covers far more ground if you
  are self-hosting and need that.
- **One instance.** Keys and quotas live in SQLite on a mounted volume, so running several replicas
  against one volume will not work. Horizontal scaling needs a real database first.
- **Renders are admission-controlled.** Over capacity the API returns `503` with `Retry-After`
  rather than queueing without limit. See the table above for measured behaviour.
- **Two days old at the time of writing**, with no paying users yet.

## How it works

TypeScript, Fastify, and Puppeteer driving one shared Chromium with a page per request. `node:sqlite`
holds keys, quotas and events, so there are no native dependencies to build.

The parts that took the actual work are the unglamorous ones:

- **Print CSS.** `break-inside: avoid` on tables, rows, list items, code blocks, blockquotes and
  figures; `thead { display: table-header-group }` so headers repeat; `orphans`/`widows`;
  `break-after: avoid` on headings so none is stranded at the foot of a page.
- **Header and footer templates**, which are a separate document from your page: they ignore the page
  CSS and render at near-zero font size unless the styles are inlined, and they sit outside the
  content margins.
- **Admission control**, because one Chromium tab per concurrent request is how the container runs
  out of memory.
- **Network isolation** for a renderer that executes untrusted JavaScript. See Security.

## Licence

MIT — see [LICENSE](LICENSE).
