import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { ANALYTICS } from "./analytics.js";

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

/** Raw markdown source of a post, for Accept: text/markdown negotiation. */
export function getPostSource(slug: string): string | undefined {
  if (!existsSync(POSTS_DIR)) return undefined;
  for (const f of readdirSync(POSTS_DIR)) {
    if (!f.endsWith(".md")) continue;
    const raw = readFileSync(join(POSTS_DIR, f), "utf8");
    const { meta, content } = parseFrontmatter(raw);
    if ((meta.slug ?? f.replace(/\.md$/, "")) === slug) return content.trim();
  }
  return undefined;
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

export const STYLE = `
  /* Same system as the landing page: a true neutral near-black, no green cast.
     Variable NAMES are unchanged so every page using them keeps working; only the
     values move. --raised is new, for the one-step-up surface the landing page uses. */
  :root { --bg:#0b0b0c; --cell:#101012; --raised:#16161a; --line:#1f1f24; --line-str:#2b2b32;
          --ink:#ededf0; --mut:#6e6e78; --acc:#3ce0a5; --acc-ink:#04170f; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);line-height:1.7;
       font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       font-size:15.5px;font-feature-settings:"cv02","cv03","cv04","ss01";
       -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  a{color:var(--acc);text-decoration:none} a:hover{text-decoration:underline}
  code,pre,.mono{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace}
  h1,h2,h3,p,li{text-wrap:pretty}

  .wrap{max-width:1180px;margin:0 auto;padding:26px 28px}
  .cell{background:var(--cell);border:1px solid var(--line);border-radius:10px;padding:22px 26px;
        position:relative}
  /* Same bar as the landing page: compact, sticky, one hairline. A 1.5rem brand and an
     uppercase CTA made every inner page read as a different site. */
  .head{display:flex;flex-direction:row;align-items:center;gap:18px;flex-wrap:wrap;
        padding:0;height:58px;margin-bottom:22px;border-bottom:1px solid var(--line)}
  .head .brand{display:flex;align-items:center;gap:9px;font-weight:640;font-size:15px;
               letter-spacing:-.015em;color:var(--ink)}
  .head .brand:hover{text-decoration:none}
  .head .brand svg{width:20px;height:20px}
  .head .what{color:var(--mut);font-size:12.5px;padding-left:18px;border-left:1px solid var(--line)}
  .head .nav{margin-left:auto;display:flex;align-items:center;gap:22px}
  .head .nav a{color:#a1a1aa;font-size:13.5px;transition:color .15s ease}
  .head .nav a:hover{color:var(--ink);text-decoration:none}
  .head .cta{border:1px solid #1f6b52;color:var(--acc);padding:6px 13px;border-radius:6px;
             font-weight:560;font-size:13px;letter-spacing:0;
             transition:background .16s ease,border-color .16s ease,color .16s ease}
  .head .cta:hover{background:var(--acc);border-color:var(--acc);color:var(--acc-ink);text-decoration:none}

  .body-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  article{max-width:74ch}
  .tag{position:absolute;top:10px;right:14px;color:#3ca882;font-size:.68rem;letter-spacing:.14em;font-weight:600}

  h1{font-size:clamp(1.6rem,3vw,2.3rem);line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
  h2{font-size:1.25rem;margin:34px 0 10px;letter-spacing:-.01em}
  h3{font-size:1.02rem;margin:26px 0 8px}
  .meta{color:var(--mut);font-size:.82rem;margin-bottom:26px}
  p,li{color:#c8c8cf}
  pre{background:#101012;border:1px solid var(--line);border-radius:8px;padding:15px 17px;
      overflow-x:auto;font-size:.82rem;line-height:1.55;color:#cfe9dd}
  pre code{background:none;padding:0;color:inherit}
  /* Long inline spans (URLs, expressions) wrap on narrow screens. Without box-decoration-break the
     background box tears in half across the line break and reads as a rendering fault. */
  code{background:#16161a;padding:.12em .38em;border-radius:4px;font-size:.86em;color:var(--acc);
       overflow-wrap:break-word;-webkit-box-decoration-break:clone;box-decoration-break:clone}
  table{border-collapse:collapse;width:100%;font-size:.9rem;margin:16px 0;display:block;overflow-x:auto}
  th,td{border:1px solid var(--line);padding:9px 12px;text-align:left}
  th{background:#16161a;color:var(--mut);font-size:.84rem}
  blockquote{border-left:3px solid var(--acc);margin:18px 0;padding:2px 0 2px 16px;color:var(--mut)}
  hr{border:none;border-top:1px solid var(--line);margin:32px 0}

  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
  .card{display:block;background:var(--cell);border:1px solid var(--line);border-radius:10px;
        padding:20px 22px;transition:border-color .15s}
  .card:hover{border-color:#2b2b32;text-decoration:none}
  .card h2{margin:0 0 6px;font-size:1.08rem;color:var(--ink)}
  .card p{margin:0;color:var(--mut);font-size:.92rem}
  .card .d{color:#6e6e78;font-size:.72rem;margin-top:10px;letter-spacing:.06em}

  .endnote{margin-top:34px;border-top:1px solid var(--line);padding-top:18px;color:var(--mut);
           font-size:.92rem}
  footer{max-width:1180px;margin:0 auto;padding:10px 30px 44px;color:var(--mut);font-size:.74rem;
         display:flex;gap:20px;flex-wrap:wrap;align-items:center}
  footer .fnav{margin-left:auto;display:flex;gap:18px}
  footer a{color:var(--mut)} footer a:hover{color:var(--acc)}
  @media (max-width:640px){ .head .what{display:none} }
`;

export const MARK = `<svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M18 43V13" stroke="#ededf0" stroke-width="3" stroke-linecap="round"/>
  <path d="M18 19C18 11 25 6 35 6c0 9-7 14-17 13z" fill="#3ce0a5"/>
  <path d="M18 32c0-7 6-11 14-11 0 8-6 12-14 11z" fill="#3ce0a5" opacity=".5"/></svg>`;

export const FAVICON =
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
<style>${STYLE}</style>${ANALYTICS}</head><body>
<div class="wrap">
  <div class="cell head">
    <a class="brand" href="/">${MARK}MintPDF</a>
    <span class="what">HTML &amp; Markdown → PDF API · MCP native</span>
    <span class="nav">
      <a href="/">API</a>
      <a href="/markdown-to-pdf">Free converter</a>
      <a href="/guides">Guides</a>
      <a class="cta" href="/#keys">Free key</a>
    </span>
  </div>
  ${opts.body}
</div>
<script>setTimeout(function(){try{fetch('/v1/beacon',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({path:location.pathname,ref:document.referrer})});}catch(e){}},4000);</script>
<footer>
  <span>MintPDF · questions or bug reports welcome</span>
  <span class="fnav">
    <a href="/">API</a><a href="/guides">Guides</a><a href="/llms.txt">llms.txt</a>
    <a href="https://x.com/Peterhallanderr"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-2px"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> @Peterhallanderr</a>
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
    : `<p style="color:var(--mut)">First guides are being written. Check back shortly.</p>`;
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
  const urls = [
    "",
    "/markdown-to-pdf",
    "/json-to-pdf",
    "/csv-to-pdf",
    "/guides",
    ...getPosts().map((p) => `/guides/${p.slug}`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${baseUrl}${u}</loc></url>`).join("\n")}
</urlset>`;
}
