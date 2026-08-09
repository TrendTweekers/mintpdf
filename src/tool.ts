/**
 * The free Markdown to PDF converter page.
 *
 * Its job is twofold: rank for people searching "markdown to pdf", and let them
 * use the product before deciding anything. It calls the same public API a
 * developer would, so what they see is exactly what they would get from code.
 */

const SAMPLE = `# Invoice #42

**Acme Ltd**  ·  9 August 2026

| Item    | Qty | Price   |
|:--------|:---:|--------:|
| Widget  |  2  |   $9.00 |
| Gadget  |  1  |  $24.00 |
| **Total** |   | **$33.00** |

> Payment due within 14 days.

Thanks for your business.
`;

export function renderTool(baseUrl: string, mark: string, favicon: string, style: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Markdown to PDF converter, free and without signup</title>
<meta name="description" content="Paste Markdown, get a clean PDF. Tables, code blocks and page numbers included. No signup, no watermark, files deleted after an hour.">
<link rel="canonical" href="${baseUrl}/markdown-to-pdf">
<meta property="og:title" content="Markdown to PDF converter, free and without signup">
<meta property="og:description" content="Paste Markdown, get a clean PDF. No signup, no watermark.">
<meta property="og:type" content="website">
<link rel="icon" href="${favicon}">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Markdown to PDF converter",
 "url":"${baseUrl}/markdown-to-pdf","applicationCategory":"UtilitiesApplication",
 "operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},
 "description":"Paste Markdown and download a styled PDF. No signup required."}
</script>
<style>${style}
  .tool { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .pane { background:var(--cell); border:1px solid var(--line); border-radius:10px; padding:20px 22px;
          display:flex; flex-direction:column; position:relative; }
  .pane h2 { margin:0 0 12px; font-size:1rem; letter-spacing:-.01em; }
  textarea { flex:1; min-height:340px; background:#090d0b; border:1px solid var(--line);
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
  .preview { flex:1; border:1px solid var(--line); border-radius:8px; background:#fdfdf8;
             min-height:340px; display:flex; align-items:center; justify-content:center;
             color:#8a8a80; font-size:.85rem; overflow:hidden; }
  .preview iframe { width:100%; height:100%; min-height:340px; border:none; }
  .keybox { margin-top:14px; border-top:1px solid var(--line); padding-top:14px; display:none; }
  .keybox.show { display:block; }
  @media (max-width:900px){ .tool { grid-template-columns:1fr; } }
</style></head><body>
<div class="wrap">
  <div class="cell head">
    <a class="brand" href="/">${mark}MintPDF</a>
    <span class="what">HTML &amp; Markdown → PDF API · MCP native</span>
    <span class="nav">
      <a href="/">API</a><a href="/guides">Guides</a>
      <a class="cta" href="/#keys">GET A FREE KEY</a>
    </span>
  </div>

  <div class="cell">
    <h1 style="margin:0 0 8px;font-size:clamp(1.5rem,2.6vw,2.1rem);letter-spacing:-.02em">Markdown to PDF, free and without signup</h1>
    <p style="margin:0;color:var(--mut);max-width:78ch">Paste Markdown on the left, get a styled PDF on
    the right. Tables, code blocks, blockquotes and page numbers are handled for you. Nothing is stored:
    the file is deleted an hour after it is made.</p>
  </div>

  <div class="tool" style="margin-top:14px">
    <div class="pane">
      <h2>Your Markdown</h2>
      <textarea id="src" spellcheck="false">${SAMPLE.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textarea>
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

  <div class="cell" style="margin-top:14px">
    <h2 style="margin:0 0 8px;font-size:1.05rem">The same thing from your code</h2>
    <p style="margin:0 0 10px;color:var(--mut)">This page is a thin wrapper over the public API. The
    identical conversion from a terminal:</p>
<pre style="margin:0;background:#090d0b;border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:.8rem;color:#cfe4db">curl -X POST ${baseUrl}/v1/pdf \\
  -H "Content-Type: application/json" \\
  -d '{"markdown":"# Invoice #42","pageNumbers":true}' \\
  --output invoice.pdf</pre>
    <p style="margin:12px 0 0;color:var(--mut);font-size:.9rem">Full <a href="/">API reference</a>, or
    add it to an AI agent with <code style="color:var(--acc)">npx -y mintpdf-mcp</code>.</p>
  </div>
</div>
<footer>
  <span>MintPDF · feedback to the address you get your key with</span>
  <span class="fnav">
    <a href="/">API</a><a href="/guides">Guides</a><a href="/llms.txt">llms.txt</a>
    <a href="https://github.com/TrendTweekers/mintpdf">Source (MIT)</a>
  </span>
</footer>
<script>
(function () {
  var go = document.getElementById('go'), status = document.getElementById('status');
  var preview = document.getElementById('preview'), dl = document.getElementById('dl');
  var keybox = document.getElementById('keybox');
  var apiKey = null;

  go.addEventListener('click', async function () {
    var md = document.getElementById('src').value;
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
        return;
      }
      if (!data.download_url) { status.textContent = data.error || 'Something went wrong.'; return; }
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
