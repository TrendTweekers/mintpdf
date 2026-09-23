---
slug: markdown-pdf-diagrams-and-math
title: Mermaid diagrams and math in a Markdown-to-PDF API
description: Diagrams and equations without loading megabytes on every render, and the inline-math syntax that stops a $9.00 price column being parsed as an equation.
date: 2026-09-22
---

Most Markdown renderers treat a document as text, a heading, a list, a table. That covers most
documents. It does not cover a system architecture in a design doc, a decision tree in a runbook, or
an equation in a report. Those get pasted in as a screenshot, or left out.

Two libraries fix this properly: Mermaid for diagrams, KaTeX for math. The interesting part is not
that you can wire them into a renderer. It is what happens if you wire them in carelessly.

## The naive version taxes every request

KaTeX's fonts are around 300KB. Mermaid's renderer is closer to 3.5MB. Load both unconditionally and
every single PDF, including a one-line invoice with neither diagrams nor equations, pays that cost.
At any real volume that is not a rounding error, it is the majority of your render time and your
egress bill, spent on documents that never asked for it.

The fix is a cheap check before the expensive one:

```ts
const hasMath = body.includes("katex");
const hasDiagram = body.includes('class="mermaid"');
```

Parse the Markdown first. Only attach the KaTeX stylesheet if the parsed output actually contains a
KaTeX node. Only load Mermaid's script and run it in the page if a code fence was tagged `mermaid`.
An invoice never touches either path. A document with one diagram and no math loads only the 3.5MB,
not both.

## Math and diagrams are solved differently, for a reason

Diagrams have to run in the browser. Mermaid takes a text description and lays out a graph, that
layout logic has to execute somewhere, and headless Chromium is already open for the print step, so
it happens there: the script is injected with `page.addScriptTag`, initialized, and run against every
`<pre class="mermaid">` block before the page is printed.

Math does not need a browser at all. KaTeX can render straight to HTML server-side, before Chromium
ever sees the page:

```ts
katex.renderToString(token.text, { displayMode: true, throwOnError: false, output: "html" })
```

That runs once, in Node, during Markdown parsing. It is faster, and it means a document with only
equations and no diagrams never launches the Mermaid path at all.

## The syntax choice that protects invoices

The obvious choice for inline math is a single `$`, the way most editors and note apps do it. This
renderer deliberately does not support that.

The reason is what these documents actually are. The most common input isn't a paper, it's an
invoice or a report, and `| Widget | $9.00 |` is a completely ordinary row in a completely ordinary
table. A single-dollar math tokenizer would read `$9.00 |` and try to typeset it as an equation,
silently. Not an error. A wrong-looking price column, discovered by a customer.

So the syntax here is unambiguous instead of familiar: display math is `$$...$$`, inline math is
`\(...\)`. Neither collides with a currency symbol, a table cell, or code containing a literal dollar
sign. The tradeoff is that anyone copying LaTeX from somewhere using single-dollar inline math has to
convert it. That is a one-line find-and-replace. A silently mangled price table is not.

## Seeing it work

Math and an untouched price row, in one document:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"Invoice-safe: \\(E = mc^2\\) stays inline.\n\nDisplay block:\n\n$$ \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2} $$\n\n| Item | Price |\n|------|------:|\n| Widget | $9.00 |\n"}' \
  --output math.pdf
```

A diagram, on its own:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"markdown":"```mermaid\ngraph TD\nA[Markdown in] --> B{Has a diagram?}\nB -->|No| C[Render immediately]\nB -->|Yes| D[Load Mermaid, render SVG]\n```\n"}' \
  --output diagram.pdf
```

Both equations render as real typeset math, the diagram renders as an SVG, and the price row stays a
price row. No signup for the first few renders a day. The renderer is
[open source](https://github.com/TrendTweekers/mintpdf) if you want to see the tokenizer rules in
context, and the same document works through [an MCP tool call](/guides/mcp-server-discoverable) if
your agent is the one writing the Markdown.
