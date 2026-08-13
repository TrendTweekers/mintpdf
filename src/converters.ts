/**
 * Data-to-PDF converter pages (JSON, CSV).
 *
 * These exist because the SERP says so. For "json to pdf" the number one result is a DA 10 site,
 * and for "csv to pdf" the bottom of page one sits around DA 26, whereas "html to pdf" has a DA 44
 * floor and belongs to Smallpdf, iLovePDF and Adobe. So we build the two that a new domain can
 * actually win, and skip the one it cannot.
 *
 * They need no new backend: the browser turns the input into Markdown and posts it to the existing
 * /v1/pdf endpoint. That keeps the rendering path, and its page-break handling, identical everywhere.
 */

import { ANALYTICS, TRACK_FN } from "./analytics.js";

interface ConverterConfig {
  slug: string;
  h1: string;
  title: string;
  description: string;
  inputLabel: string;
  sample: string;
  /** Name of the browser-side function that turns the input into Markdown. */
  transform: string;
  intro: string;
  features: { h: string; p: string }[];
  why: { h: string; body: string };
  faq: { q: string; a: string }[];
}

/** Shared browser helpers. Both converters end up as Markdown, so both get the same renderer. */
const TRANSFORMS = `
function mdEscape(s) { return String(s).replace(/\\|/g, "\\\\|").replace(/\\n/g, " "); }

function toTable(headers, rows) {
  var out = "| " + headers.map(mdEscape).join(" | ") + " |\\n";
  out += "|" + headers.map(function () { return " --- "; }).join("|") + "|\\n";
  rows.forEach(function (r) {
    out += "| " + headers.map(function (h, i) { return mdEscape(r[i] === undefined ? "" : r[i]); }).join(" | ") + " |\\n";
  });
  return out;
}

/* A real CSV parser rather than split(","), because quoted fields containing commas, quotes and
   newlines are the normal case in exported data, not an edge case. */
function parseCsv(text) {
  var rows = [], row = [], field = "", inQuotes = false, i = 0;
  text = text.replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");
  while (i < text.length) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.length > 1 || (r[0] || "").trim() !== ""; });
}

function csvToMarkdown(text) {
  var rows = parseCsv(text);
  if (!rows.length) throw new Error("That does not look like CSV.");
  var headers = rows[0];
  return toTable(headers, rows.slice(1));
}

function jsonToMarkdown(text) {
  var data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error("That is not valid JSON: " + e.message); }

  /* An array of flat objects is the common shape of an export, and a table is far more readable
     than pretty-printed braces. Anything else stays as formatted JSON, which is honest. */
  if (Array.isArray(data) && data.length && data.every(function (r) {
    return r && typeof r === "object" && !Array.isArray(r) &&
      Object.values(r).every(function (v) { return v === null || typeof v !== "object"; });
  })) {
    var headers = [];
    data.forEach(function (r) {
      Object.keys(r).forEach(function (k) { if (headers.indexOf(k) === -1) headers.push(k); });
    });
    var rows = data.map(function (r) {
      return headers.map(function (h) { return r[h] === undefined || r[h] === null ? "" : String(r[h]); });
    });
    return toTable(headers, rows);
  }
  return "\\u0060\\u0060\\u0060json\\n" + JSON.stringify(data, null, 2) + "\\n\\u0060\\u0060\\u0060\\n";
}
`;

const CONFIGS: Record<string, ConverterConfig> = {
  "json-to-pdf": {
    slug: "json-to-pdf",
    h1: "JSON to PDF",
    title: "JSON to PDF | Free online converter, no signup",
    description:
      "Convert JSON to a readable PDF online. An array of objects becomes a proper table, anything else stays as formatted JSON. Free, no signup, no watermark.",
    inputLabel: "Your JSON",
    transform: "jsonToMarkdown",
    sample: `[
  { "id": 1, "item": "Widget", "qty": 2, "price": "$9.00" },
  { "id": 2, "item": "Gadget", "qty": 1, "price": "$24.00" },
  { "id": 3, "item": "Doohickey", "qty": 5, "price": "$3.50" }
]`,
    intro:
      "Paste JSON and get a PDF you can actually hand to somebody. An array of flat objects is turned into a real table with a header row. Anything else is kept as formatted, indented JSON rather than being mangled into a shape it does not fit.",
    features: [
      {
        h: "Arrays become tables",
        p: "An array of objects is the usual shape of an export, and a table is far easier to read than nested braces. Keys become columns, in the order they first appear.",
      },
      {
        h: "Everything else stays JSON",
        p: "Nested or irregular data is printed as indented JSON in a monospaced block. Forcing it into a table would lose information, so we do not pretend.",
      },
      {
        h: "Tables that survive page breaks",
        p: "A long export runs to several pages. The header row repeats on each one, and rows are never sliced in half at the boundary.",
      },
      {
        h: "Nothing is uploaded twice",
        p: "The JSON is turned into a document in your browser and rendered once. The file is deleted an hour later.",
      },
    ],
    why: {
      h: "Why convert JSON to PDF?",
      body: `<p>JSON is written for programs and PDFs are written for people, so the conversion usually happens
      at the moment those two audiences meet.</p>
      <ul>
        <li><strong>Sharing an API response</strong> with someone who will not open a terminal.</li>
        <li><strong>Attaching an export</strong> to a ticket, an email or an audit trail.</li>
        <li><strong>Reviewing data on paper</strong>, where a table beats a scroll bar.</li>
        <li><strong>Archiving a record</strong> in a format that will still open in ten years.</li>
      </ul>`,
    },
    faq: [
      { q: "Does it handle nested JSON?", a: "Yes, but not as a table. Nested or irregular data is rendered as indented, readable JSON, because flattening it into columns would quietly lose information." },
      { q: "Is there a size limit?", a: "The document sent for rendering is limited to 5MB, which is a very large amount of tabular JSON." },
      { q: "Do you store my data?", a: "The PDF is kept for one hour so you can download it, then deleted. The JSON itself is turned into a document in your browser. If the data is confidential, use a local tool instead." },
      { q: "Is it free?", a: "Yes. A few conversions a day need no account, and a free key raises that to 100 a month with nothing but an email address." },
      { q: "Can I do this from code?", a: "Yes. Convert your JSON to Markdown or HTML and POST it to the API, which is exactly what this page does." },
    ],
  },

  "csv-to-pdf": {
    slug: "csv-to-pdf",
    h1: "CSV to PDF",
    title: "CSV to PDF | Free online converter, no signup",
    description:
      "Convert CSV to a clean PDF table online. Quoted fields, commas inside values and header rows that repeat across pages. Free, no signup, no watermark.",
    inputLabel: "Your CSV",
    transform: "csvToMarkdown",
    sample: `Item,Qty,Price,Note
Widget,2,$9.00,"In stock, ships today"
Gadget,1,$24.00,Backordered
Doohickey,5,$3.50,"Bulk discount applies"`,
    intro:
      "Paste CSV and get a clean PDF table. Quoted fields containing commas are handled properly, the first row becomes the header, and that header repeats on every page rather than only the first.",
    features: [
      {
        h: "A real CSV parser",
        p: "Quoted fields, commas inside values and escaped quotes are parsed correctly. Splitting on commas is what breaks most simple converters on real exported data.",
      },
      {
        h: "Headers repeat across pages",
        p: "A spreadsheet running to four pages labels its columns on all four, which is the difference between a usable printout and a puzzle.",
      },
      {
        h: "Rows are never cut in half",
        p: "A row that will not fit moves to the next page whole rather than being split across the boundary.",
      },
      {
        h: "No signup, no watermark",
        p: "The PDF you download is not branded, on any plan, and the file is deleted an hour after it is made.",
      },
    ],
    why: {
      h: "Why convert CSV to PDF?",
      body: `<p>A CSV is not a document. It opens differently in every spreadsheet, it will happily reformat your
      dates and strip your leading zeros, and it cannot be sent to somebody with any confidence about what
      they will see.</p>
      <ul>
        <li><strong>Sending a report</strong> that must look the same for everyone.</li>
        <li><strong>Printing a list</strong> for stock-taking, delivery or signing.</li>
        <li><strong>Attaching data to a record</strong> where the layout has to be fixed.</li>
        <li><strong>Sharing an export</strong> with someone who does not want to open Excel.</li>
      </ul>`,
    },
    faq: [
      { q: "Does it handle commas inside quoted fields?", a: "Yes. The parser handles quoted fields, embedded commas, embedded newlines and escaped double quotes, which is where naive converters usually break." },
      { q: "What about semicolon-separated files?", a: "Not yet. Many European exports use semicolons, and support for that is worth adding. For now, replace the separators before pasting." },
      { q: "Will a wide table fit the page?", a: "Very wide tables are tight on A4. Switch the page size to A3 or turn on landscape, both of which are in the options under the editor." },
      { q: "Do you store my data?", a: "The CSV is turned into a document in your browser. The resulting PDF is kept for one hour so you can download it, then deleted." },
      { q: "Is it free?", a: "Yes. A few conversions a day with no account, or 100 a month with a free key that asks only for an email address." },
    ],
  },
};

export const CONVERTER_SLUGS = Object.keys(CONFIGS);

export function renderConverter(
  slug: string,
  baseUrl: string,
  mark: string,
  favicon: string,
  style: string,
): string | undefined {
  const cfg = CONFIGS[slug];
  if (!cfg) return undefined;

  const others = CONVERTER_SLUGS.filter((s) => s !== slug);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cfg.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${cfg.title}</title>
<meta name="description" content="${cfg.description}">
<link rel="canonical" href="${baseUrl}/${cfg.slug}">
<meta property="og:title" content="${cfg.title}">
<meta property="og:description" content="${cfg.description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${baseUrl}/${cfg.slug}">
<link rel="icon" href="${favicon}">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"${cfg.h1} converter",
 "url":"${baseUrl}/${cfg.slug}","applicationCategory":"UtilitiesApplication","operatingSystem":"Any",
 "offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},
 "description":"${cfg.description}"}
</script>
<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>
<style>${style}
  .tool { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .pane { background:var(--cell); border:1px solid var(--line); border-radius:10px; padding:20px 22px;
          display:flex; flex-direction:column; }
  .pane h2 { margin:0 0 12px; font-size:1rem; letter-spacing:-.01em; }
  textarea { flex:1; min-height:320px; background:#090d0b; border:1px solid var(--line);
             border-radius:8px; color:#cfe4db; padding:14px 16px; font-size:.84rem; line-height:1.6;
             font-family:"SF Mono",ui-monospace,Consolas,Menlo,monospace; resize:vertical; }
  textarea:focus { outline:none; border-color:var(--acc); }
  .opts { display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin:14px 0 0;
          color:var(--mut); font-size:.82rem; }
  .opts label { display:flex; align-items:center; gap:7px; cursor:pointer; }
  .opts select { background:#090d0b; border:1px solid var(--line); color:var(--ink);
                 border-radius:6px; padding:5px 8px; font-family:inherit; font-size:.8rem; }
  .go { margin-top:14px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .go button { background:var(--acc); color:var(--acc-ink); border:none; border-radius:8px;
               padding:11px 22px; font-weight:700; font-size:.86rem; letter-spacing:.04em;
               cursor:pointer; font-family:inherit; }
  .go button:hover { filter:brightness(1.08); }
  .go button:disabled { opacity:.5; cursor:default; }
  .note { color:var(--mut); font-size:.78rem; }
  /* Shown only after someone has converted a few documents, counted in their own browser and never
     sent anywhere. The server cannot see repeat visitors (the visitor hash is re-salted daily and on
     purpose), so this is the one honest way to notice that somebody keeps coming back. The pitch uses
     THEIR document, because a working example of your own input is far more convincing than ours. */
  .apinudge { border:1px solid var(--acc); border-radius:8px; padding:13px 15px; margin-top:12px;
              background:rgba(60,224,165,.05); }
  .apinudge strong { display:block; font-size:.86rem; margin-bottom:3px; }
  .apinudge p { margin:0 0 8px; color:var(--mut); font-size:.78rem; }
  .apinudge pre { margin:0 0 9px; padding:10px 11px; background:#090d0b; border-radius:6px;
                  font-size:.7rem; line-height:1.5; color:#9ecbff; overflow-x:auto; white-space:pre; }
  .apinudge a { color:var(--acc); text-decoration:none; font-size:.8rem; font-weight:700; }
  .apinudge a:hover { text-decoration:underline; }
  .preview { flex:1; border:1px solid var(--line); border-radius:8px; background:#fdfdf8;
             min-height:320px; display:flex; align-items:center; justify-content:center;
             color:#8a8a80; font-size:.85rem; overflow:hidden; }
  .preview iframe { width:100%; height:100%; min-height:320px; border:none; }
  .feats { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; margin-top:14px; }
  .feat { background:var(--cell); border:1px solid var(--line); border-radius:10px; padding:18px 20px; }
  .feat h3 { margin:0 0 6px; font-size:.95rem; letter-spacing:-.01em; }
  .feat p { margin:0; color:var(--mut); font-size:.86rem; line-height:1.55; }
  .prose { max-width:78ch; }
  .prose h2 { margin:0 0 10px; font-size:1.15rem; letter-spacing:-.01em; }
  .prose p, .prose li { color:var(--mut); line-height:1.65; }
  .faq dt { font-weight:600; margin-top:16px; color:var(--ink); font-size:.92rem; }
  .faq dd { margin:5px 0 0; color:var(--mut); line-height:1.62; font-size:.88rem; }
  .rel { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
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
    <h1 style="margin:0 0 8px;font-size:clamp(1.6rem,2.8vw,2.2rem);letter-spacing:-.02em">${cfg.h1}</h1>
    <p style="margin:0;color:var(--mut);max-width:78ch">${cfg.intro}</p>
  </div>

  <div class="tool" style="margin-top:14px">
    <div class="pane">
      <h2>${cfg.inputLabel}</h2>
      <textarea id="src" spellcheck="false" aria-label="${cfg.inputLabel}">${cfg.sample
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</textarea>
      <div class="opts">
        <label><input type="checkbox" id="pn" checked> page numbers</label>
        <label>size
          <select id="fmt"><option>A4</option><option>Letter</option><option>Legal</option><option>A3</option><option>A5</option></select>
        </label>
        <label>orientation
          <select id="ls"><option value="">portrait</option><option value="1">landscape</option></select>
        </label>
      </div>
      <div class="go">
        <button id="go">CONVERT TO PDF</button>
        <span class="note" id="status">Free, no account. A few conversions a day per visitor.</span>
      </div>
    </div>
    <div class="pane">
      <h2>Your PDF</h2>
      <div class="preview" id="preview">The rendered document appears here.</div>
      <div class="go"><a id="dl" class="note" href="#" style="display:none">Download the PDF →</a></div>
      <div class="apinudge" id="apinudge" hidden>
        <strong>You have made a few of these now.</strong>
        <p>The same document from your own code, no page needed:</p>
        <pre id="nudgecurl"></pre>
        <a href="/" id="nudgelink">Read the API reference →</a>
      </div>
    </div>
  </div>

  <div class="feats">
    ${cfg.features.map((f) => `<div class="feat"><h3>${f.h}</h3><p>${f.p}</p></div>`).join("\n    ")}
  </div>

  <div class="cell prose" style="margin-top:14px">
    <h2>${cfg.why.h}</h2>
    ${cfg.why.body}

    <h2>The same conversion from your code</h2>
    <p>This page turns your input into Markdown in the browser and posts it to a public API. From a
    script it is one request:</p>
<pre style="margin:0;background:#090d0b;border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:.8rem;color:#cfe4db">curl -X POST ${baseUrl}/v1/pdf \\
  -H "Content-Type: application/json" \\
  -d '{"markdown":"| Item | Price |\\n|---|---|\\n| Widget | $9.00 |","pageNumbers":true}' \\
  --output table.pdf</pre>
    <p style="margin:12px 0 0">See the <a href="/">API reference</a>, or add it to an AI agent with
    <code style="color:var(--acc)">npx -y mintpdf-mcp</code>.</p>

    <h2>Other free converters</h2>
    <div class="rel">
      <a href="/markdown-to-pdf">Markdown to PDF</a>
      ${others.map((s) => `<a href="/${s}">${CONFIGS[s].h1}</a>`).join("\n      ")}
      <a href="/guides">Guides</a>
    </div>

    <h2>Frequently asked questions</h2>
    <dl class="faq">
      ${cfg.faq.map((f) => `<dt>${f.q}</dt><dd>${f.a}</dd>`).join("\n      ")}
    </dl>
  </div>
</div>
<footer>
  <span>MintPDF · questions or bug reports welcome</span>
  <span class="fnav">
    <a href="/">API</a><a href="/guides">Guides</a><a href="/llms.txt">llms.txt</a>
    <a href="https://github.com/TrendTweekers/mintpdf">Source (MIT)</a>
  </span>
</footer>
<script>
(function () {${TRACK_FN}
${TRANSFORMS}
  var go = document.getElementById('go'), status = document.getElementById('status');
  var preview = document.getElementById('preview'), dl = document.getElementById('dl');
  var src = document.getElementById('src');

  /* How many documents this person has made, kept in their own browser and never sent to us. The
     server deliberately cannot answer this: the visitor hash is re-salted every midnight, so anyone
     who returns tomorrow is a new stranger to it. Counting locally is the only way to notice a repeat
     user without starting to track people. */
  function bumpCount() {
    try {
      var n = (parseInt(localStorage.getItem('mintpdf.made') || '0', 10) || 0) + 1;
      localStorage.setItem('mintpdf.made', String(n));
      return n;
    } catch (e) { return 0; }   // private mode, storage disabled: just never nudge
  }

  /* Pitch the API with the document they just made. A curl they can paste and watch work beats any
     generic example, because it proves the API produces the thing already on their screen. */
  function showApiNudge(markdown, why) {
    var box = document.getElementById('apinudge');
    if (!box || !box.hidden) return;            // never show it twice in one visit
    var sample = markdown.length > 220 ? markdown.slice(0, 220) + '\\n…' : markdown;
    document.getElementById('nudgecurl').textContent =
      'curl -X POST https://mintpdf.dev/v1/pdf \\\\\\n' +
      '  -H "Content-Type: application/json" \\\\\\n' +
      '  -d ' + JSON.stringify(JSON.stringify({ markdown: sample, pageNumbers: true })) + ' \\\\\\n' +
      '  --output document.pdf';
    box.hidden = false;
    track('api-nudge-shown', { page: '${cfg.slug}', why: why });
    var link = document.getElementById('nudgelink');
    if (link) link.addEventListener('click', function () {
      track('api-nudge-clicked', { page: '${cfg.slug}', why: why });
    });
  }

  go.addEventListener('click', async function () {
    var markdown;
    try {
      markdown = ${cfg.transform}(src.value);
    } catch (e) {
      status.textContent = e.message;
      return;
    }
    if (!markdown.trim()) { status.textContent = 'Nothing to convert yet.'; return; }
    go.disabled = true; status.textContent = 'rendering…';
    try {
      var res = await fetch('/v1/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: markdown,
          pageNumbers: document.getElementById('pn').checked,
          format: document.getElementById('fmt').value,
          landscape: !!document.getElementById('ls').value,
          output: 'url'
        })
      });
      var data = await res.json();
      if (res.status === 429) {
        // Someone who wants an eleventh document today is the most qualified visitor this page ever
        // gets. Offer both roads out, not just the free key.
        status.textContent = 'Daily free limit reached. A free key raises it to 100 a month, or use the API.';
        showApiNudge(markdown, 'limit');
        track('limit-hit', { page: '${cfg.slug}' });
        return;
      }
      if (!data.download_url) {
        status.textContent = data.error || 'Something went wrong.';
        track('render-failed', { page: '${cfg.slug}' });
        return;
      }
      track('render', { source: '${cfg.slug}' });
      preview.innerHTML = '<iframe src="' + data.download_url + '#toolbar=0" title="Rendered PDF"></iframe>';
      dl.href = data.download_url; dl.style.display = 'inline';
      var left = res.headers.get('x-ratelimit-remaining');
      status.textContent = 'Done, ' + Math.round(data.size_bytes / 1024) + ' KB' +
        (left !== null ? ' · ' + left + ' conversions left today' : '') + ' · link expires in an hour';
      if (bumpCount() >= 3) showApiNudge(markdown, 'repeat');
    } catch (e) {
      status.textContent = 'Network error. Try again.';
    } finally { go.disabled = false; }
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
