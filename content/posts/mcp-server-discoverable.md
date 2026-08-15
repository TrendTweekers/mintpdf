---
slug: mcp-server-discoverable
title: Why agent tooling cannot find your MCP server
description: Shipping an MCP server is not the same as being discoverable. The well-known files, Link headers and content negotiation that agent tooling checks for.
date: 2026-08-09
---

I shipped an MCP server. It was listed in the official registry, published to npm, indexed by a
directory, open source, working.

Then I ran it through an agent-readiness scanner and got **21 out of 100**, with a flat **0 out of 7**
in the section called "API, Auth, MCP & Skill Discovery".

Zero out of seven, for a product whose entire pitch is being usable by AI agents. That is a useful
kind of embarrassing, because it separates two things I had quietly merged: *having* an interface for
agents, and being *discoverable* by them.

Here is everything that turned out to be missing, what each file is actually for, and the one I chose
to keep failing.

## The gap

An MCP server that is listed in a registry is findable by anything that reads that registry. It is
invisible to an agent that lands on your domain, because arriving at `example.com` tells an agent
nothing about the machine-readable surface behind it.

Over the last year a set of conventions has grown for exactly that problem. Most are drafts. Several
will not survive. But they are cheap to implement, and the ones that stick will decide whether an
agent that finds your site can do anything with it.

## What to serve

### `/.well-known/mcp.json`: the MCP server card

The one that matters most if you have an MCP server. It says where the endpoint is, what transport it
speaks, and what it can do.

```json
{
  "serverInfo": { "name": "MintPDF", "version": "0.1.1" },
  "description": "Turn HTML or Markdown into a clean, styled PDF and get a download link.",
  "url": "https://mintpdf.dev/mcp",
  "transport": { "type": "streamable-http" },
  "capabilities": { "tools": true },
  "tools": [
    { "name": "generate_pdf", "description": "Render HTML or Markdown to a PDF and return a download URL." },
    { "name": "pdf_from_url", "description": "Render a public web page to a PDF and return a download URL." }
  ],
  "packages": [{ "registry": "npm", "identifier": "mintpdf-mcp", "transport": "stdio" }]
}
```

Include the package as well as the remote URL. Plenty of clients would rather install than connect.

### `/llms.txt`: your product in one fetch

A plain-text summary an agent can read in a single request instead of parsing your marketing HTML.
What it does, how to call it, limits, pricing, privacy.

The mistake to avoid is writing marketing copy in a text file. The value is density: endpoints,
parameters, real limits, the actual command. If a competent developer could integrate from it without
opening your site, it is right.

### `/openapi.json`: the REST surface

If you have an HTTP API, describe it. OpenAPI 3.1, including your auth scheme and error responses.
Cheap to generate, and unlike your documentation page it does not go stale silently, because you can
test it.

### `/.well-known/api-catalog`: the index of your APIs (RFC 9727)

The one genuine standard in this list rather than a draft. `application/linkset+json`, listing each
API with links to its description, documentation and status:

```json
{
  "linkset": [
    {
      "anchor": "https://mintpdf.dev/v1/pdf",
      "service-desc": [{ "href": "https://mintpdf.dev/openapi.json", "type": "application/json" }],
      "service-doc":  [{ "href": "https://mintpdf.dev", "type": "text/html" }],
      "status":       [{ "href": "https://mintpdf.dev/health", "type": "application/json" }]
    },
    {
      "anchor": "https://mintpdf.dev/mcp",
      "service-desc": [{ "href": "https://mintpdf.dev/.well-known/mcp.json", "type": "application/json" }]
    }
  ]
}
```

Serve it with the right content type. `application/json` is not the same thing and checkers notice.

### `Link` headers (RFC 8288): discovery without a fetch

Everything above only helps if the agent knows to look. Link headers advertise it on every response:

```
Link: </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json",
      </openapi.json>; rel="service-desc"; type="application/json",
      </llms.txt>; rel="describedby"; type="text/plain",
      </.well-known/mcp.json>; rel="mcp-server"; type="application/json"
```

Two things cost me time here.

**Send them on HEAD as well as GET.** My hook checked `req.method === "GET"`, which is the obvious
thing to write, and scanners generally use HEAD. It looked like the header was missing entirely.

**Framework encapsulation applies.** In Fastify, a hook registered *after* a plugin does not apply to
that plugin's routes. My header was live on API routes and absent on every static file, including the
homepage, purely because of the order of two lines.

### Markdown content negotiation

Return Markdown when asked, keep HTML as the default:

```
GET /guides/some-article
Accept: text/markdown
→ 200 text/markdown
```

Add `Vary: Accept` so caches do not serve the wrong representation. If you already write your content
in Markdown, you are serving a file you have; if you generate it from HTML, an agent gets your page
without a DOM parse and a hundred lines of navigation chrome.

### Agent skills

A skills index at `/.well-known/agent-skills/index.json`, each entry pointing at a `SKILL.md` with a
`sha256` for integrity. The skill file is a short document teaching an agent how to do the thing:
when to use it, the fastest call, the options, the limits.

Writing one is a good exercise regardless. If you cannot explain your product's core action in a page
without referring to your UI, the API is probably harder to use than you think.

### WebMCP: tools for the agent in the browser

If an agent is browsing your page, it can call a tool you register on the page itself:

```js
if (navigator.modelContext?.registerTool) {
  navigator.modelContext.registerTool({
    name: "generate_pdf",
    description: "Turn Markdown or HTML into a styled PDF and return a download URL.",
    inputSchema: {
      type: "object",
      properties: { markdown: { type: "string" }, pageNumbers: { type: "boolean" } }
    },
    async execute(args) {
      const res = await fetch("/v1/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...args, output: "url" })
      });
      return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
    }
  });
}
```

Feature-detect and wrap it. The API is emerging and should never be able to break your page.

### Content Signals in `robots.txt`

```
User-agent: *
Content-Signal: ai-train=yes, search=yes, ai-input=yes
Allow: /
```

Choose deliberately rather than copying. For a developer tool I want `ai-train=yes`: if models train
on my documentation, future models can recommend the product when someone asks how to generate a PDF
from Markdown. For a publisher whose revenue is pageviews, the opposite is obviously right. It is a
business decision wearing a robots directive.

## The one I refused

Three checks stayed red, all OAuth: `/.well-known/openid-configuration`,
`/.well-known/oauth-protected-resource`, and an `auth.md` variant that requires them.

MintPDF does not use OAuth. Authentication is a bearer API key, and the key *is* the account: no
login, no password, no dashboard. Publishing OAuth discovery metadata would mean advertising
authorization and token endpoints that do not exist. Any agent that trusted them would follow them
into a dead end.

So I served `/auth.md` describing the real scheme, and left the OAuth checks failing.

This matters more than the points. The entire value of these files is that an agent can trust them
without a human checking. A file that exists to pass a scan, describing capabilities you do not have,
is worse than no file: it converts "I cannot discover how to authenticate" into "I discovered how,
and it was wrong". Optimising the number instead of the truth defeats the thing the number measures.

## Result

Level 1 to Level 5, with the OAuth checks still deliberately failing. Content accessibility and bot
access control went to full marks, and the discovery section went from 0/7 to 5/8.

Total work: a handful of static files, two response headers, one content-negotiation hook, and about
twenty lines of JavaScript.

## One warning

Somewhere in the middle of adding these, I registered a route for `/` to handle Markdown negotiation.
In Fastify, that route shadowed the static index, and `callNotFound()` does not fall through to
static files. My homepage returned 404 for about ten minutes, in production, while I was busy raising
an agent-readiness score.

Add the discovery files. They are cheap and they will matter. Just do not let a checklist take down
the thing it is describing.

---

## See the files in place

Every document described above is live on this domain, so you can read a working example rather than
a specification:

[`/.well-known/mcp.json`](/.well-known/mcp.json) ·
[`/.well-known/api-catalog`](/.well-known/api-catalog) ·
[`/.well-known/agent-card.json`](/.well-known/agent-card.json) ·
[`/.well-known/agent-skills/index.json`](/.well-known/agent-skills/index.json) ·
[`/llms.txt`](/llms.txt) ·
[`/openapi.json`](/openapi.json) ·
[`/auth.md`](/auth.md)

The server they describe is [MintPDF](/), and its source is
[on GitHub](https://github.com/TrendTweekers/mintpdf) under MIT.
