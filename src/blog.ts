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
  :root { --bg:#0a0e0c; --cell:#0e1412; --line:#233830; --ink:#e9f1ed; --mut:#8ea69c;
          --acc:#3ce0a5; --acc-ink:#052b1e; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);line-height:1.75;
       font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:16px}
  a{color:var(--acc);text-decoration:none} a:hover{text-decoration:underline}
  code,pre{font-family:"SF Mono",ui-monospace,Consolas,Menlo,monospace}
  nav{border-bottom:1px solid var(--line);background:#0c110f}
  nav .in{max-width:800px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;gap:12px}
  nav .brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:1.05rem;color:var(--ink)}
  nav .cta{margin-left:auto;background:var(--acc);color:var(--acc-ink);padding:7px 14px;
           border-radius:7px;font-weight:700;font-size:.82rem}
  main{max-width:800px;margin:0 auto;padding:44px 22px 70px}
  h1{font-size:2rem;line-height:1.2;letter-spacing:-.5px;margin:0 0 10px}
  h2{font-size:1.3rem;margin:38px 0 10px;letter-spacing:-.2px}
  h3{font-size:1.05rem;margin:28px 0 8px}
  .meta{color:var(--mut);font-size:.85rem;margin-bottom:32px}
  p,li{color:#cfdcd6}
  pre{background:#090d0b;border:1px solid var(--line);border-radius:9px;padding:15px 17px;
      overflow-x:auto;font-size:.83rem;line-height:1.55;color:#cfe4db}
  pre code{background:none;padding:0}
  code{background:#121917;padding:.12em .38em;border-radius:4px;font-size:.86em;color:var(--acc)}
  table{border-collapse:collapse;width:100%;font-size:.9rem;margin:16px 0;display:block;overflow-x:auto}
  th,td{border:1px solid var(--line);padding:9px 12px;text-align:left}
  th{background:var(--cell);color:var(--mut);font-size:.84rem}
  blockquote{border-left:3px solid var(--acc);margin:18px 0;padding:2px 0 2px 16px;color:var(--mut)}
  hr{border:none;border-top:1px solid var(--line);margin:34px 0}
  .card{display:block;background:var(--cell);border:1px solid var(--line);border-radius:10px;
        padding:18px 20px;margin-bottom:12px;transition:border-color .15s}
  .card:hover{border-color:#2f4b40;text-decoration:none}
  .card h2{margin:0 0 5px;font-size:1.1rem;color:var(--ink)}
  .card p{margin:0;color:var(--mut);font-size:.92rem}
  .card .d{color:#54695f;font-size:.75rem;margin-top:7px}
  footer{max-width:800px;margin:0 auto;padding:22px;border-top:1px solid var(--line);
         color:var(--mut);font-size:.82rem}
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
<link rel="icon" href="${FAVICON}">
<style>${STYLE}</style></head><body>
<nav><div class="in"><a class="brand" href="/">${MARK}MintPDF</a>
<a href="/guides">Guides</a><a class="cta" href="/#keys">GET FREE KEY</a></div></nav>
${opts.body}
<footer>MintPDF · <a href="/">API</a> · <a href="/guides">Guides</a> ·
<a href="https://github.com/TrendTweekers/mintpdf">GitHub</a></footer>
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
    body: `<main><h1>Guides</h1>
<p class="meta">Generating documents from code and from agents, without the usual friction.</p>
${cards}</main>`,
  });
}

export function renderPost(post: Post, baseUrl: string): string {
  return shell({
    title: `${post.title} — MintPDF`,
    description: post.description,
    canonical: `${baseUrl}/guides/${post.slug}`,
    body: `<main><article><h1>${esc(post.title)}</h1>
<div class="meta">${esc(post.date)}</div>${post.body}</article></main>`,
  });
}

export function renderSitemap(baseUrl: string): string {
  const urls = ["", "/guides", ...getPosts().map((p) => `/guides/${p.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${baseUrl}${u}</loc></url>`).join("\n")}
</urlset>`;
}
