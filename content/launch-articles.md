# MintPDF launch articles (drafts, 2026-08-09)

Three pieces for the first two weeks. URLs currently point at the Railway host; find/replace once the
custom domain is live. **Verification rules applied:** every competitor claim below is either
first-hand verified (marked ✅) or flagged UNVERIFIED and must be checked before publishing. Kimi's
original drafts described PDFShift as a "template editor" product, which is false, and invented a
personal history of self-hosting Gotenberg, which never happened. Both are corrected here.

Verified 2026-08-09 by direct fetch:
- ✅ Gotenberg: MIT licence, free, self-hosted via Docker, Chromium + LibreOffice, "over 12,000 stars
  and 68 million Docker pulls", "up and running in two commands".
- ✅ PDFShift: HTML/CSS → PDF REST API, "Built for developers, by developers", "300+ Million
  Conversions", free plan "50 credits/month, no credit card required", Chromium-powered.
  **It is not a template-editor product.**
- UNVERIFIED (check before publishing): APITemplate pricing/positioning, PDFMonkey pricing,
  DocRaptor pricing and PrinceXML backend, Anvil pricing. Do not publish revenue estimates for any
  competitor at all.

---

## Article 1 — "HTML to PDF APIs in 2026: what actually differs"

Target: `html to pdf api`, `pdf generation api`, `pdf api comparison`.
Publish: own domain first, then dev.to canonical-linked back.

### Draft

Every HTML-to-PDF service renders with headless Chromium. Almost none of them differ where the
marketing says they do. Having built one, here is the honest map of what actually varies.

**1. Do you run the browser, or does someone else?**

Gotenberg is MIT-licensed, free, and self-hosted: two Docker commands and you own the whole pipeline,
with Chromium and LibreOffice inside. Its 68 million Docker pulls are not an accident; if PDF
generation is core to your product and you have somewhere to run containers, this is the correct
default and no hosted API will beat free.

The catch is not the setup, it's the ongoing ownership: Chromium security updates, memory ceilings on
large documents, concurrency, queueing. That's fine when it's your core; it's overhead when a PDF is
a side effect of something else you're building.

**2. Template-first or content-first?**

This is the real fork in the road.

Template-first services (APITemplate, PDFMonkey) have you design a document in their UI, save a
template ID, then POST JSON to fill it. Good when a non-developer owns the document design and it
changes without deploys. Bad when the content is generated dynamically, because you end up
maintaining template IDs for documents that a program already knows how to produce.

Content-first services (PDFShift, MintPDF) take the markup itself. PDFShift has been doing this at
serious scale, 300 million conversions and counting, with a Chromium renderer and a free tier of 50
credits a month.

If an LLM or your own code is writing the document, template IDs are a step you don't need.

**3. Rendering engine**

Chromium is the norm and handles ordinary CSS fine. Print-grade engines like PrinceXML (used by
DocRaptor — UNVERIFIED, check) support paged-media CSS more completely: precise page breaks, running
headers, cross-references. If you're producing a book or a legal filing, that difference matters. For
invoices, receipts, and reports, it does not.

**4. What happens to the file afterwards**

Rarely on comparison pages, always in the security review. Ask: is the document stored? For how long?
Can it be reached without authentication? MintPDF deletes generated files after one hour and stores
no documents; other services offer retention, which is convenient and a different risk posture. Pick
deliberately.

**5. Can an agent call it?**

New in 2026 and mostly unaddressed: if an AI agent is writing the document, it needs a tool
interface, not just a REST endpoint. MintPDF ships an MCP server so Claude and other MCP clients can
render a document mid-conversation. (Article 2 covers this in full.)

**Choosing**

- PDF generation is core, you have infrastructure → Gotenberg, self-hosted.
- Non-developers own the document design → a template-first service.
- Print-grade paged media → a PrinceXML-backed service.
- Your code or your agent writes the content, you want no template step → PDFShift, or MintPDF if you
  also want the MCP path and a free tier without signup.

*Disclosure: I built MintPDF. Gotenberg is genuinely the right answer for a large share of readers,
which is why it is first on this list.*

---

## Article 2 — "Let Claude hand you a finished PDF"

Target: `pdf mcp server`, `generate pdf with claude`, `mcp pdf tool`.
Publish: own domain, then r/ClaudeAI and r/mcp as a genuine post, not a link drop.

### Draft

An agent can write a good document and then has nowhere to put it. You copy Markdown out of the chat,
paste it somewhere that renders, export, and fix the styling. The document was ready; the last
hundred metres weren't.

MCP fixes that, and PDF generation is a natural fit: a tool call in, a file out.

**Setup**

```json
{
  "mcpServers": {
    "mintpdf": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR-DOMAIN/mcp"]
    }
  }
}
```

Restart the client and two tools appear:

- `generate_pdf` — HTML or Markdown in, download URL out
- `pdf_from_url` — a public web page in, PDF out

Then, in plain language: "Summarise this thread as a one-page brief with page numbers and give me a
PDF." The agent writes the Markdown, calls the tool, and returns a link.

**Why Markdown output looks right**

Agents write Markdown natively. Raw Markdown converted to PDF usually looks like a text file: no
table borders, cramped code blocks, headings that don't read as headings. MintPDF applies a default
stylesheet, so tables, code, blockquotes and headers come out formatted with no design work from the
agent or from you. Send `html` instead when you want full control.

**The honest limits**

- Hosted, not air-gapped. If documents can't leave your network, self-host Gotenberg instead.
- Free tier: 5 renders/day anonymously, 100/day with a free key (email, no card).
- Chromium rendering. Ordinary CSS is fine; exotic paged-media CSS is not its strength.
- Download links expire after one hour and nothing is stored afterwards.

**Try it without an MCP client**

```bash
curl -X POST https://YOUR-DOMAIN/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Test\n\nGenerated via API.","pageNumbers":true}' \
  --output test.pdf
```

---

## Article 3 — "Why MintPDF is MCP-native"

Target: `mcp native api`, `agent tools pdf`, brand queries.
Publish: own domain + Indie Hackers.

⚠️ **Peter: check this against your own experience before publishing.** It states only what is true
as far as I know (you build with agents daily; the MCP surface is new and thinly served). If any
sentence isn't your experience, cut it. Do not let a fabricated origin story ship; developers ask
follow-up questions and an invented history is fatal to the trust this whole strategy depends on.

### Draft

I build software with AI agents every day. They can research, write and reason; then, when the useful
artefact is a document someone else has to read, the workflow stops at a wall of Markdown in a chat
window.

The APIs to fix that exist and are good. What almost none of them had, in mid-2026, was a way for an
agent to call them directly. The tooling assumed a human writing code, at exactly the moment the
software writing the code stopped being human.

So MintPDF is deliberately small:

- One endpoint that takes HTML, Markdown or a URL and returns a PDF.
- The same capability as an MCP server, so an agent can use it without glue code.
- Markdown styled properly by default, because agent output is Markdown.
- No template editor, no template IDs, no dashboard.
- Files deleted after an hour, no document storage, no account required to try.

**What I am not claiming**

Not that this is technically novel. It's Chromium in a container, like everything in this category.
Gotenberg is excellent and free if you want to run your own. PDFShift has done hundreds of millions
of conversions. If those fit, use them.

The bet is narrower: agents are becoming a real consumer of developer APIs, and tools built for that
from the start will be easier to use than tools that bolt it on later.

**Where it is now**

Free beta. Free tier stays free; a paid tier around $19/month arrives when volume limits do, and beta
users keep beta pricing. No per-seat pricing, no sales calls.

If you try it and something is wrong, tell me; at this stage that's worth more than a signup.

---

## Publishing sequence

| When | What | Where |
|---|---|---|
| Day 1 | Article 1 | own domain, then dev.to with canonical link |
| Day 3 | Article 2 | own domain, then r/ClaudeAI + r/mcp (genuine post, answer questions, no drive-by links) |
| Day 5 | MCP registry submissions | mcp.so, Glama, Smithery, official registry — **needs a public repo** |
| Day 7 | Article 3 | own domain + Indie Hackers |
| Weekly after | one new piece: a specific how-to (invoices, reports, receipts) or a genuine build note | own domain first, always |

Rules learned the hard way: no link-dropping in comment threads (accounts get banned and the channel
is wasted); no competitor revenue estimates; no unverified claims about other people's products; and
no measuring before ~90 days, because a fresh domain shows nothing in two weeks and a false kill is
worse than no reading at all.
