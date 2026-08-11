/**
 * The free Markdown to PDF converter page.
 *
 * This is the site's primary organic-search asset, not the blog. Every page currently ranking for
 * "markdown to pdf" is a working tool rather than an article, and the two leaders sit at DA 31 and
 * DA 28 with a DA 11 site holding page one, so the query is winnable on merit rather than authority.
 * The page therefore has to be a genuinely good converter first and a landing page second.
 */

import { ANALYTICS, TRACK_FN } from "./analytics.js";

const SAMPLES: Record<string, { label: string; body: string }> = {
  invoice: {
    label: "Invoice",
    body: `# Invoice #42

**Acme Ltd**  ·  9 August 2026

| Item      | Qty | Price   |
|:----------|:---:|--------:|
| Widget    |  2  |   $9.00 |
| Gadget    |  1  |  $24.00 |
| **Total** |     | **$33.00** |

> Payment due within 14 days.

Thanks for your business.
`,
  },
  diagram: {
    label: "Report with a diagram",
    body: `# Release notes

## How a document is built

\`\`\`mermaid
graph LR
  A[Markdown] --> B[MintPDF]
  B --> C[PDF]
\`\`\`

## What changed

- Diagrams render as vector graphics
- Tables keep their column alignment
- Code blocks are never cut in half
`,
  },
  maths: {
    label: "Maths",
    body: `# Gaussian integral

The area of a circle is \\(\\pi r^2\\), and the classic result is:

$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$

Display maths uses \`$$ ... $$\` and inline maths uses \`\\( ... \\)\`.
`,
  },
};

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. A few conversions a day need no account at all. A free key raises that to 100 a month and only asks for an email address. There is no card and no trial that expires.",
  },
  {
    q: "Does the PDF have a watermark?",
    a: "No. The file you download is the file you would get from the paid API. We do not brand your documents, on any plan.",
  },
  {
    q: "Do I need to sign up?",
    a: "Not to use this page. Paste Markdown, press convert, download the PDF.",
  },
  {
    q: "What happens to my file?",
    a: "It is rendered, held for one hour so you can download it, then deleted. It is never indexed, shared or used for anything else. If a document is confidential, generate it locally instead: honest advice is worth more than your one conversion.",
  },
  {
    q: "Does it support Mermaid diagrams and LaTeX maths?",
    a: "Yes. Fenced mermaid blocks render as vector diagrams, and maths is typeset with KaTeX. Use $$ ... $$ for display maths and \\( ... \\) for inline maths.",
  },
  {
    q: "Why not single dollars for inline maths?",
    a: "Because invoices. A table row reading | Widget | $9.00 | would be parsed as maths and silently mangled, and price tables matter more to most documents than inline equations do.",
  },
  {
    q: "Can I use this from my own code?",
    a: "Yes, this page is a thin wrapper over a public REST API, and there is an MCP server so AI agents can call it directly.",
  },
];

export function renderTool(baseUrl: string, mark: string, favicon: string, style: string): string {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Markdown to PDF | Free online converter, no signup</title>
<meta name="description" content="Convert Markdown to a polished PDF online. Tables, code blocks, Mermaid diagrams and LaTeX maths, with page breaks that do not cut content in half. Free, no signup, no watermark.">
<link rel="canonical" href="${baseUrl}/markdown-to-pdf">
<meta property="og:title" content="Markdown to PDF | Free online converter, no signup">
<meta property="og:description" content="Paste Markdown, get a styled PDF. Diagrams, maths and tables included. No signup, no watermark.">
<meta property="og:type" content="website">
<meta property="og:url" content="${baseUrl}/markdown-to-pdf">
<link rel="icon" href="${favicon}">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Markdown to PDF converter",
 "url":"${baseUrl}/markdown-to-pdf","applicationCategory":"UtilitiesApplication",
 "operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},
 "featureList":["Tables with column alignment","Syntax-highlighted code blocks","Mermaid diagrams","LaTeX maths via KaTeX","Page breaks that keep blocks whole","No watermark"],
 "description":"Paste Markdown and download a styled PDF. No signup required."}
</script>
<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>
<style>${style}
  .tool { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .pane { background:var(--cell); border:1px solid var(--line); border-radius:10px; padding:20px 22px;
          display:flex; flex-direction:column; position:relative; }
  .pane h2 { margin:0 0 12px; font-size:1rem; letter-spacing:-.01em; }
  textarea { flex:1; min-height:340px; background:#090d0b; border:1px solid var(--line);
             border-radius:8px; color:#cfe4db; padding:14px 16px; font-size:.84rem; line-height:1.6;
             font-family:"SF Mono",ui-monospace,Consolas,Menlo,monospace; resize:vertical; }
  textarea:focus { outline:none; border-color:var(--acc); }
  .samples { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 10px; }
  .samples button { background:transparent; border:1px solid var(--line); color:var(--mut);
                    border-radius:999px; padding:5px 12px; font-size:.74rem; cursor:pointer;
                    font-family:inherit; transition:border-color .15s,color .15s; }
  .samples button:hover, .samples button[aria-pressed="true"] { border-color:var(--acc); color:var(--acc); }
  .opts { display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin:14px 0 0;
          color:var(--mut); font-size:.82rem; }
  .opts label { display:flex; align-items:center; gap:7px; cursor:pointer; }
  .opts select { background:#090d0b; border:1px solid var(--line); color:var(--ink);
                 border-radius:6px; padding:5px 8px; font-family:inherit; font-size:.8rem; }
  .go { margin-top:14px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .go button#go { background:var(--acc); color:var(--acc-ink); border:none; border-radius:8px;
               padding:11px 22px; font-weight:700; font-size:.86rem; letter-spacing:.04em;
               cursor:pointer; font-family:inherit; }
  .go button#go:hover { filter:brightness(1.08); }
  .go button#go:disabled { opacity:.5; cursor:default; }
  .note { color:var(--mut); font-size:.78rem; }
  .preview { flex:1; border:1px solid var(--line); border-radius:8px; background:#fdfdf8;
             min-height:340px; display:flex; align-items:center; justify-content:center;
             color:#8a8a80; font-size:.85rem; overflow:hidden; }
  .preview iframe { width:100%; height:100%; min-height:340px; border:none; }
  .keyform { display:flex; margin-top:10px; background:#090d0b; border:1px solid var(--line);
             border-radius:7px; overflow:hidden; transition:border-color .15s; max-width:420px; }
  .keyform:focus-within { border-color:var(--acc); }
  .keyform input { flex:1; min-width:0; background:transparent; border:none; color:var(--ink);
                   padding:11px 13px; font-size:.82rem; font-family:inherit; }
  .keyform input::placeholder { color:#4f6a5e; }
  .keyform input:focus { outline:none; }
  .keyform button { background:transparent; border:none; border-left:1px solid var(--line);
                    color:var(--acc); padding:0 18px; font-weight:700; font-size:.72rem;
                    letter-spacing:.12em; cursor:pointer; font-family:inherit; white-space:nowrap; }
  .keyform button:hover { background:var(--acc); color:var(--acc-ink); }
  .keyout { margin-top:10px; color:var(--mut); font-size:.78rem; overflow-wrap:anywhere; }
  .keyout code { color:var(--acc); }
  .keybox { margin-top:14px; border-top:1px solid var(--line); padding-top:14px; display:none; }
  .keybox.show { display:block; }
  .feats { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; margin-top:14px; }
  .feat { background:var(--cell); border:1px solid var(--line); border-radius:10px; padding:18px 20px; }
  .feat h3 { margin:0 0 6px; font-size:.95rem; letter-spacing:-.01em; }
  .feat p { margin:0; color:var(--mut); font-size:.86rem; line-height:1.55; }
  .prose { max-width:78ch; }
  .prose h2 { margin:0 0 10px; font-size:1.15rem; letter-spacing:-.01em; }
  .prose h3 { margin:18px 0 4px; font-size:.95rem; }
  .prose p, .prose li { color:var(--mut); line-height:1.65; }
  .faq dt { font-weight:600; margin-top:16px; color:var(--ink); font-size:.92rem; }
  .faq dd { margin:5px 0 0; color:var(--mut); line-height:1.62; font-size:.88rem; }
  .guidelinks { display:flex; flex-direction:column; gap:8px; margin:10px 0 0; padding:0; list-style:none; }
  .guidelinks a { color:var(--acc); text-decoration:none; }
  .guidelinks a:hover { text-decoration:underline; }
  .rel { display:flex; gap:10px; flex-wrap:wrap; }
  .rel a { color:var(--acc); text-decoration:none; border:1px solid var(--line);
           border-radius:999px; padding:6px 14px; font-size:.82rem; }
  .rel a:hover { border-color:var(--acc); }
  @media (max-width:900px){ .tool { grid-template-columns:1fr; } }
</style>${ANALYTICS}</head><body>
<div class="wrap">
  <div class="cell head">
    <a class="brand" href="/">${mark}MintPDF</a>
    <span class="what">HTML &amp; Markdown → PDF API · MCP native</span>
    <span class="nav">
      <a href="/">API</a><a href="/markdown-to-pdf">Free converter</a><a href="/guides">Guides</a>
      <a class="cta" href="/#keys">GET A FREE KEY</a>
    </span>
  </div>

  <div class="cell">
    <h1 style="margin:0 0 8px;font-size:clamp(1.6rem,2.8vw,2.2rem);letter-spacing:-.02em">Markdown to PDF</h1>
    <p style="margin:0;color:var(--mut);max-width:78ch">Paste Markdown on the left and get a polished
    PDF on the right. Tables keep their alignment, code blocks and diagrams are never cut in half by a
    page break, and Mermaid diagrams and LaTeX maths both render. Free, no account, no watermark.</p>
  </div>

  <div class="tool" style="margin-top:14px">
    <div class="pane">
      <h2>Your Markdown</h2>
      <div class="samples" id="samples">
        ${Object.entries(SAMPLES)
          .map(
            ([k, s], i) =>
              `<button type="button" data-sample="${k}" aria-pressed="${i === 0 ? "true" : "false"}">${s.label}</button>`,
          )
          .join("")}
      </div>
      <textarea id="src" spellcheck="false" aria-label="Markdown input">${SAMPLES.invoice.body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</textarea>
      <div class="opts">
        <label><input type="checkbox" id="pn" checked> page numbers</label>
        <label>size
          <select id="fmt"><option>A4</option><option>Letter</option><option>Legal</option><option>A3</option><option>A5</option></select>
        </label>
        <label>margin
          <select id="mg"><option value="18mm">normal</option><option value="10mm">narrow</option><option value="28mm">wide</option></select>
        </label>
      </div>
      <div class="go">
        <button id="go">CONVERT TO PDF</button>
        <span class="note" id="status">Free, no account. A few conversions a day per visitor.</span>
      </div>
      <div class="keybox" id="keybox">
        <p class="note" style="margin:0 0 8px">Out of free conversions for today. A free key raises it to
        100 a month, no card:</p>
        <form class="keyform" id="keyform" autocomplete="off">
          <input id="email" type="email" required placeholder="you@example.com" aria-label="Your email">
          <button type="submit">GET KEY</button>
        </form>
        <div class="keyout" id="keyout"></div>
      </div>
    </div>

    <div class="pane">
      <h2>Your PDF</h2>
      <div class="preview" id="preview">The rendered document appears here.</div>
      <div class="go">
        <a id="dl" class="note" href="#" style="display:none">Download the PDF →</a>
      </div>
    </div>
  </div>

  <div class="feats">
    <div class="feat">
      <h3>Tables that keep their alignment</h3>
      <p>Right-aligned price columns stay right-aligned, and a table running onto a second page
      repeats its header row instead of leaving you guessing which column is which.</p>
    </div>
    <div class="feat">
      <h3>Mermaid diagrams</h3>
      <p>A fenced <code>mermaid</code> block becomes a vector diagram in the PDF. Flowcharts,
      sequence diagrams and the rest, sharp at any zoom because it is not an image.</p>
    </div>
    <div class="feat">
      <h3>LaTeX maths</h3>
      <p>Typeset with KaTeX and its real maths fonts. <code>$$ ... $$</code> for display maths,
      <code>\\( ... \\)</code> for inline. Single dollars stay as currency, so invoices survive.</p>
    </div>
    <div class="feat">
      <h3>Page breaks that behave</h3>
      <p>Code blocks, tables and blockquotes are kept whole, headings are never stranded alone at the
      foot of a page, and paragraphs do not leave a single orphan line behind.</p>
    </div>
  </div>

  <div class="cell prose" style="margin-top:14px">
    <h2>Why convert Markdown to PDF?</h2>
    <p>Markdown is the easiest format to write and the worst to hand to somebody. It renders
    differently in every editor, it assumes the reader has one, and it cannot be signed, printed or
    attached to an email with any confidence about how it will look.</p>
    <p>A PDF fixes the layout. The usual reasons people convert:</p>
    <ul>
      <li><strong>Invoices and quotes</strong> written as a table, sent as a document.</li>
      <li><strong>Reports and documentation</strong> that need to be readable without a repository.</li>
      <li><strong>Release notes and changelogs</strong> attached to a release.</li>
      <li><strong>Notes and essays</strong> from an editor like Obsidian or a plain text file.</li>
      <li><strong>AI output</strong>, since language models write Markdown by default and almost
      nobody wants to read it that way.</li>
    </ul>

    <h2>What happens to your file</h2>
    <p>It is rendered, kept for one hour so you can download it, then deleted. It is not indexed, not
    shared, and not used to train anything.</p>
    <p>That said, it does leave your machine. If a document is genuinely confidential, run a converter
    locally instead. We would rather say that plainly than win one conversion.</p>

    <h2>The same conversion from your code</h2>
    <p>This page is a thin wrapper over a public API, so what you see here is exactly what you get
    from a script:</p>
<pre style="margin:0;background:#090d0b;border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:.8rem;color:#cfe4db">curl -X POST ${baseUrl}/v1/pdf \\
  -H "Content-Type: application/json" \\
  -d '{"markdown":"# Invoice #42","pageNumbers":true}' \\
  --output invoice.pdf</pre>
    <p style="margin:12px 0 0">There is a <a href="/">full API reference</a>, a
    <a href="https://github.com/TrendTweekers/markdown-to-pdf-action">GitHub Action</a> for converting
    files in CI, and an MCP server so an AI agent can make PDFs itself with
    <code style="color:var(--acc)">npx -y mintpdf-mcp</code>.</p>

    <h2>Other free converters</h2>
    <p style="margin:0 0 10px">Same renderer, same page-break handling, no account needed:</p>
    <div class="rel">
      <a href="/json-to-pdf">JSON to PDF</a>
      <a href="/csv-to-pdf">CSV to PDF</a>
    </div>

    <h2 style="margin-top:22px">Guides</h2>
    <ul class="guidelinks">
      <li><a href="/guides/chromium-pdf-page-breaks">Why headless Chrome splits PDFs in the wrong places</a></li>
      <li><a href="/guides/pdf-github-action">How to generate a PDF in a GitHub Action</a></li>
      <li><a href="/guides/pdf-mcp-server-claude">Giving Claude the ability to make PDFs</a></li>
      <li><a href="/guides">All guides</a></li>
    </ul>

    <h2>Frequently asked questions</h2>
    <dl class="faq">
      ${FAQ.map((f) => `<dt>${f.q}</dt><dd>${f.a}</dd>`).join("\n      ")}
    </dl>
  </div>
</div>
<footer>
  <span>MintPDF · questions or bug reports welcome</span>
  <span class="fnav">
    <a href="/">API</a><a href="/guides">Guides</a><a href="/llms.txt">llms.txt</a>
    <a href="https://x.com/Peterhallanderr"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-2px"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> @Peterhallanderr</a>
    <a href="https://github.com/TrendTweekers/mintpdf">Source (MIT)</a>
  </span>
</footer>
<script>
(function () {${TRACK_FN}
  var SAMPLES = ${JSON.stringify(Object.fromEntries(Object.entries(SAMPLES).map(([k, v]) => [k, v.body])))};
  var go = document.getElementById('go'), status = document.getElementById('status');
  var preview = document.getElementById('preview'), dl = document.getElementById('dl');
  var keybox = document.getElementById('keybox'), src = document.getElementById('src');
  var apiKey = null;

  document.getElementById('samples').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sample]');
    if (!b) return;
    src.value = SAMPLES[b.getAttribute('data-sample')];
    [].forEach.call(this.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  });

  go.addEventListener('click', async function () {
    var md = src.value;
    if (!md.trim()) { status.textContent = 'Nothing to convert yet.'; return; }
    go.disabled = true; status.textContent = 'rendering…';
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
      var res = await fetch('/v1/pdf', {
        method: 'POST', headers: headers,
        body: JSON.stringify({
          markdown: md,
          pageNumbers: document.getElementById('pn').checked,
          format: document.getElementById('fmt').value,
          margin: document.getElementById('mg').value,
          output: 'url'
        })
      });
      var data = await res.json();
      if (res.status === 429) {
        status.textContent = 'Daily free limit reached.';
        keybox.classList.add('show');
        track('limit-hit', { page: 'markdown-to-pdf' });
        return;
      }
      if (!data.download_url) {
        status.textContent = data.error || 'Something went wrong.';
        track('render-failed', { page: 'markdown-to-pdf' });
        return;
      }
      track('render', { source: 'markdown' });
      preview.innerHTML = '<iframe src="' + data.download_url + '#toolbar=0" title="Rendered PDF"></iframe>';
      dl.href = data.download_url; dl.style.display = 'inline';
      var left = res.headers.get('x-ratelimit-remaining');
      status.textContent = 'Done, ' + Math.round(data.size_bytes / 1024) + ' KB' +
        (left !== null ? ' · ' + left + ' conversions left today' : '') + ' · link expires in an hour';
    } catch (e) {
      status.textContent = 'Network error. Try again.';
    } finally {
      go.disabled = false;
    }
  });

  document.getElementById('keyform').addEventListener('submit', async function (e) {
    e.preventDefault();
    var out = document.getElementById('keyout');
    out.textContent = 'requesting…';
    try {
      var res = await fetch('/v1/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: document.getElementById('email').value.trim() })
      });
      var data = await res.json();
      if (data.key) {
        apiKey = data.key;
        out.innerHTML = 'Key ready, this page will use it: <code>' + data.key + '</code>';
        status.textContent = 'Free key active, ' + data.daily_limit + ' conversions a month.';
        track('key-created', { page: 'markdown-to-pdf' });
      } else {
        out.textContent = data.error || 'Could not issue a key.';
      }
    } catch (err) { out.textContent = 'Network error.'; }
  });

  setTimeout(function () {
    try {
      fetch('/v1/beacon', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        keepalive: true, body: JSON.stringify({ path: location.pathname, ref: document.referrer }) });
    } catch (e) {}
  }, 4000);
})();
</script>
</body></html>`;
}
