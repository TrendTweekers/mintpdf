import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  body: string; // rendered HTML
}

const POSTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "posts");

/** Minimal frontmatter parser: `--- key: value ---` at the top of the file. No YAML dependency. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  if (!raw.startsWith("---")) return { meta: {}, content: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, content: raw };
  const meta: Record<string, string> = {};
  for (const line of raw.slice(3, end).split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    meta[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return { meta, content: raw.slice(end + 4) };
}

let cache: Post[] | null = null;

export function getPosts(): Post[] {
  if (cache) return cache;
  if (!existsSync(POSTS_DIR)) return (cache = []);
  const posts = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { meta, content } = parseFrontmatter(readFileSync(join(POSTS_DIR, f), "utf8"));
      return {
        slug: meta.slug ?? f.replace(/\.md$/, ""),
        title: meta.title ?? f,
        description: meta.description ?? "",
        date: meta.date ?? "",
        body: marked.parse(content, { async: false }) as string,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return (cache = posts);
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

const STYLE = `
  :root { --bg:#0a0e0c; --cell:#0e1412; --line:#233830; --ink:#e9f1ed; --mut:#7f978c;
          --acc:#3ce0a5; --acc-ink:#052b1e; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);line-height:1.72;
       font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:16px}
  a{color:var(--acc);text-decoration:none} a:hover{text-decoration:underline}
  code,pre,.mono{font-family:"SF Mono",ui-monospace,Consolas,Menlo,monospace}
  h1,h2,h3,p,li{text-wrap:pretty}

  .wrap{max-width:1560px;margin:0 auto;padding:26px 28px}
  .cell{background:var(--cell);border:1px solid var(--line);border-radius:10px;padding:22px 26px;
        position:relative}
  .head{display:flex;flex-direction:row;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 22px;
        margin-bottom:14px}
  .head .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.5rem;
               letter-spacing:-.02em;color:var(--ink)}
  .head .brand:hover{text-decoration:none}
  .head .what{color:var(--mut);font-size:.9rem}
  .head .nav{margin-left:auto;display:flex;align-items:center;gap:20px}
  .head .nav a{color:var(--mut);font-size:.85rem}
  .head .nav a:hover{color:var(--ink);text-decoration:none}
  .head .cta{border:1px solid var(--acc);color:var(--acc);padding:8px 15px;border-radius:7px;
             font-weight:700;font-size:.8rem;letter-spacing:.06em}
  .head .cta:hover{background:var(--acc);color:var(--acc-ink);text-decoration:none}

  .body-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  article{max-width:74ch}
  .tag{position:absolute;top:10px;right:14px;color:var(--mut);font-size:.62rem;letter-spacing:.14em}

  h1{font-size:clamp(1.6rem,3vw,2.3rem);line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
  h2{font-size:1.25rem;margin:34px 0 10px;letter-spacing:-.01em}
  h3{font-size:1.02rem;margin:26px 0 8px}
  .meta{color:var(--mut);font-size:.82rem;margin-bottom:26px}
  p,li{color:#c9d8d1}
  pre{background:#090d0b;border:1px solid var(--line);border-radius:8px;padding:15px 17px;
      overflow-x:auto;font-size:.82rem;line-height:1.55;color:#cfe4db}
  pre code{background:none;padding:0;color:inherit}
  code{background:#121917;padding:.12em .38em;border-radius:4px;font-size:.86em;color:var(--acc)}
  table{border-collapse:collapse;width:100%;font-size:.9rem;margin:16px 0;display:block;overflow-x:auto}
  th,td{border:1px solid var(--line);padding:9px 12px;text-align:left}
  th{background:#121917;color:var(--mut);font-size:.84rem}
  blockquote{border-left:3px solid var(--acc);margin:18px 0;padding:2px 0 2px 16px;color:var(--mut)}
  hr{border:none;border-top:1px solid var(--line);margin:32px 0}

  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
  .card{display:block;background:var(--cell);border:1px solid var(--line);border-radius:10px;
        padding:20px 22px;transition:border-color .15s}
  .card:hover{border-color:#2f4b40;text-decoration:none}
  .card h2{margin:0 0 6px;font-size:1.08rem;color:var(--ink)}
  .card p{margin:0;color:var(--mut);font-size:.92rem}
  .card .d{color:#54695f;font-size:.72rem;margin-top:10px;letter-spacing:.06em}

  .endnote{margin-top:34px;border-top:1px solid var(--line);padding-top:18px;color:var(--mut);
           font-size:.92rem}
  footer{max-width:1560px;margin:0 auto;padding:10px 30px 44px;color:var(--mut);font-size:.74rem;
         display:flex;gap:20px;flex-wrap:wrap;align-items:center}
  footer .fnav{margin-left:auto;display:flex;gap:18px}
  footer a{color:var(--mut)} footer a:hover{color:var(--acc)}
  @media (max-width:640px){ .head .what{display:none} }
`;

const MARK = `<svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M18 43V13" stroke="#e9f1ed" stroke-width="3" stroke-linecap="round"/>
  <path d="M18 19C18 11 25 6 35 6c0 9-7 14-17 13z" fill="#3ce0a5"/>
  <path d="M18 32c0-7 6-11 14-11 0 8-6 12-14 11z" fill="#3ce0a5" opacity=".5"/></svg>`;

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='11' fill='%233ce0a5'/%3E%3Cpath d='M19 40V16' stroke='%23052b1e' stroke-width='3.2' stroke-linecap='round'/%3E%3Cpath d='M19 21c0-7 6-11 14-11 0 8-6 12-14 11z' fill='%23052b1e'/%3E%3Cpath d='M19 33c0-6 5-9 11-9 0 7-4 10-11 9z' fill='%23052b1e' opacity='.55'/%3E%3C/svg%3E";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function shell(opts: { title: string; description: string; canonical: string; body: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(opts.canonical)}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(opts.canonical)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${FAVICON}">
<style>${STYLE}</style></head><body>
<div class="wrap">
  <div class="cell head">
    <a class="brand" href="/">${MARK}MintPDF</a>
    <span class="what">HTML &amp; Markdown → PDF API · MCP native</span>
    <span class="nav">
      <a href="/">API</a>
      <a href="/guides">Guides</a>
      <a class="cta" href="/#keys">GET A FREE KEY</a>
    </span>
  </div>
  ${opts.body}
</div>
<script>setTimeout(function(){try{fetch('/v1/beacon',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({path:location.pathname,ref:document.referrer})});}catch(e){}},4000);</script>
<footer>
  <span>MintPDF · feedback to the address you get your key with</span>
  <span class="fnav">
    <a href="/">API</a><a href="/guides">Guides</a><a href="/llms.txt">llms.txt</a>
    <a href="https://github.com/TrendTweekers/mintpdf">Source (MIT)</a>
  </span>
</footer>
</body></html>`;
}

export function renderIndex(baseUrl: string): string {
  const posts = getPosts();
  const cards = posts.length
    ? posts
        .map(
          (p) => `<a class="card" href="/guides/${p.slug}"><h2>${esc(p.title)}</h2>
<p>${esc(p.description)}</p><div class="d">${esc(p.date)}</div></a>`,
        )
        .join("\n")
    : `<p style="color:#8ea69c">First guides are being written. Check back shortly.</p>`;
  return shell({
    title: "Guides — MintPDF",
    description: "Practical guides on generating PDFs from HTML, Markdown and AI agents.",
    canonical: `${baseUrl}/guides`,
    body: `<div class="cell"><span class="tag">GUIDES</span>
<h1>Guides</h1>
<p class="meta" style="margin-bottom:0">Generating documents from code and from agents, without the usual friction.</p></div>
<div class="cards" style="margin-top:14px">${cards}</div>`,
  });
}

export function renderPost(post: Post, baseUrl: string): string {
  return shell({
    title: `${post.title} — MintPDF`,
    description: post.description,
    canonical: `${baseUrl}/guides/${post.slug}`,
    body: `<div class="cell"><span class="tag">GUIDE</span>
<article><h1>${esc(post.title)}</h1>
<div class="meta">${esc(post.date)}</div>${post.body}
<div class="endnote">Try it without signing up: <code>curl -X POST ${baseUrl}/v1/pdf -d '{"markdown":"# Hello"}'</code><br>
or add it to your MCP client with <code>npx -y mintpdf-mcp</code>. <a href="/">Full API reference →</a></div>
</article></div>`,
  });
}

export function renderSitemap(baseUrl: string): string {
  const urls = ["", "/guides", ...getPosts().map((p) => `/guides/${p.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${baseUrl}${u}</loc></url>`).join("\n")}
</urlset>`;
}
