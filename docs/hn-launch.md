# Show HN plan

Post at 15:00 CEST (09:00 US Eastern, 06:00 US Pacific). https://news.ycombinator.com/submit

- **Title:** `Show HN: MintPDF – HTML/Markdown to PDF API with an MCP server`
- **URL:** `https://mintpdf.dev`
- **Text box:** leave empty. A URL post with an author comment does better than a text post.
- Post the comment below immediately after submitting, as the first comment.

## First comment

I built this because every HTML-to-PDF path I tried broke in the same place: page breaks.

Headless Chromium will happily slice a table row in half, strand a heading at the foot of a page, and drop the table header so page 3 is a wall of numbers with no idea what the columns mean. The fix is not a library, it is print CSS that almost nobody writes: `break-inside: avoid` on the right elements, `thead { display: table-header-group }` so headers repeat, `break-after: avoid` on headings so they stay with their content, and orphans/widows. That is most of what MintPDF is. Chromium does the rendering, the value is in the stylesheet in front of it.

Two ways in. A REST API (`POST /v1/pdf` with `markdown` or `html`) and an MCP server, remote at `https://mintpdf.dev/mcp` or local via `npx -y mintpdf-mcp`. The MCP part is the reason it exists: agents emit Markdown constantly and people want a document at the end, and every option in between was a template editor or a document store.

Two things I would want to know if I were reading this:

**It executes your JavaScript**, because Mermaid and KaTeX need it. So requests to private and internal addresses are blocked at two independent layers, URL validation with DNS resolution and request-time interception with re-resolution, with IPv6 classified at the byte level (mapped, NAT64, Teredo, link-local). Only refusals are cached, never approvals, so DNS rebinding does not get a window. There is a test suite for the usual bypasses.

**Chromium is heavy.** Renders go through a semaphore with a bounded queue and return 503 with Retry-After when full, rather than the whole box falling over. I found that out the honest way, by melting my own machine with an ungated load test.

10 renders a day with no signup, a free key raises it to 100 a month. MIT licensed with a container image, so you can skip me entirely and self-host. Files are deleted after an hour and document content is not logged.

It is a few days old and I am one person, so I would rather hear what breaks than what is nice.
