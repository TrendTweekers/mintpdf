import puppeteer, { Browser } from "puppeteer";
import { marked } from "marked";
import katex from "katex";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { assertPublicUrl, isPrivateHost } from "./ssrf.js";

const require_ = createRequire(import.meta.url);
const katexDir = join(dirname(require_.resolve("katex/package.json")), "dist");
const mermaidJs = join(dirname(require_.resolve("mermaid/package.json")), "dist", "mermaid.min.js");

/**
 * KaTeX's stylesheet points at ~20 font files with relative URLs. The render target is a
 * `setContent` page with no base URL and no network access, so those requests would silently fail
 * and the maths would fall back to whatever serif the container happens to have. Inlining the woff2
 * files as data URIs (~296KB, only ever attached when a document actually contains maths) keeps the
 * typography correct and the renderer fully offline.
 */
let katexCssCache: string | null = null;
function katexCss(): string {
  if (katexCssCache !== null) return katexCssCache;
  let css = readFileSync(join(katexDir, "katex.min.css"), "utf8");
  // Remove the woff/ttf fallbacks first, so nothing is left pointing at a URL we did not inline.
  css = css.replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g, "");
  css = css.replace(/url\(fonts\/([^)]+)\.woff2\)/g, (whole: string, name: string) => {
    const file = join(katexDir, "fonts", `${name}.woff2`);
    if (!existsSync(file)) return whole;
    return `url(data:font/woff2;base64,${readFileSync(file).toString("base64")})`;
  });
  return (katexCssCache = css);
}

/**
 * Markdown extensions for maths and diagrams.
 *
 * Deliberately NOT supporting single-dollar inline maths. The most common documents through this
 * API are invoices, and `| Widget | $9.00 |` would be parsed as maths, silently mangling every
 * price table. Display maths uses `$$...$$`, inline maths uses `\(...\)`. Both are unambiguous.
 */
const mathBlock = {
  name: "mathBlock",
  level: "block" as const,
  start(src: string) {
    return src.indexOf("$$");
  },
  tokenizer(src: string) {
    const m = /^\$\$([\s\S]+?)\$\$(?:\n+|$)/.exec(src);
    return m ? { type: "mathBlock", raw: m[0], text: m[1].trim() } : undefined;
  },
  renderer(token: { text: string }) {
    return katex.renderToString(token.text, { displayMode: true, throwOnError: false, output: "html" });
  },
};

const mathInline = {
  name: "mathInline",
  level: "inline" as const,
  start(src: string) {
    return src.indexOf("\\(");
  },
  tokenizer(src: string) {
    const m = /^\\\(([\s\S]+?)\\\)/.exec(src);
    return m ? { type: "mathInline", raw: m[0], text: m[1].trim() } : undefined;
  },
  renderer(token: { text: string }) {
    return katex.renderToString(token.text, { displayMode: false, throwOnError: false, output: "html" });
  },
};

const md = marked.use({
  extensions: [mathBlock, mathInline],
  renderer: {
    code(token: { text: string; lang?: string }) {
      if ((token.lang ?? "").trim().toLowerCase() === "mermaid") {
        return `<pre class="mermaid">${escapeHtml(token.text)}</pre>`;
      }
      return false; // fall through to marked's default code renderer
    },
  },
});

export interface PdfOptions {
  format?: "A4" | "Letter" | "Legal" | "A3" | "A5";
  landscape?: boolean;
  margin?: string; // e.g. "20mm" applied to all sides
  pageNumbers?: boolean;
  headerText?: string;
  footerText?: string;
  printBackground?: boolean;
  scale?: number;
  waitForNetworkIdle?: boolean;
}

const MARKDOWN_STYLE = `
  /* Print-first defaults: this stylesheet only applies to the markdown path,
     where we own the design. Raw HTML input is rendered exactly as sent. */
  :root { color-scheme: light; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
         color: #1a1a1a; background: #fff; line-height: 1.6; font-size: 11pt; max-width: 100%; }

  /* Keep blocks whole across page boundaries. A block taller than a page still splits,
     which is unavoidable, but nothing small gets cut in half any more. */
  pre, table, blockquote, figure, img { break-inside: avoid; page-break-inside: avoid; }
  tr, li { break-inside: avoid; page-break-inside: avoid; }
  p { orphans: 3; widows: 3; }
  h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }

  h1 { font-size: 22pt; border-bottom: 1px solid #ddd; padding-bottom: .3em; }
  h2 { font-size: 16pt; margin-top: 1.4em; }
  h3 { font-size: 13pt; }
  code { background: #f4f4f4; padding: .15em .35em; border-radius: 3px;
         font-family: "SF Mono", Consolas, Menlo, monospace; font-size: .9em; }
  pre { background: #f4f4f4; padding: 1em; border-radius: 6px;
        white-space: pre-wrap; overflow-wrap: anywhere; }
  pre code { background: none; padding: 0; }

  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: .45em .7em; text-align: left;
           overflow-wrap: anywhere; }
  th { background: #f7f7f7; }
  /* Markdown column alignment must win over the default above. */
  th[align="center"], td[align="center"] { text-align: center; }
  th[align="right"], td[align="right"] { text-align: right; }
  /* Repeat the header row when a table runs onto the next page. */
  thead { display: table-header-group; }

  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #555; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.6em 0; }

  /* Diagrams. The .mermaid element starts life as a <pre> holding the source, so it must not
     inherit the code-block styling, and it must never be split across a page. */
  pre.mermaid { background: none; border: none; padding: 0; margin: 1.4em 0;
                text-align: center; break-inside: avoid; page-break-inside: avoid;
                font-family: inherit; white-space: normal; }
  pre.mermaid svg { max-width: 100%; height: auto; }

  /* Maths. Display equations get room to breathe and are kept whole; long inline maths is
     allowed to wrap rather than run off the page edge. */
  .katex-display { margin: 1.2em 0; break-inside: avoid; page-break-inside: avoid; }
  .katex { font-size: 1.05em; }
  .katex-display > .katex { white-space: normal; }
`;

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });
    const browser = await browserPromise;
    browser.on("disconnected", () => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

function headerFooterTemplate(text: string | undefined, pageNumbers: boolean, isFooter: boolean): string {
  if (!text && !(isFooter && pageNumbers)) return "<span></span>";
  const num = isFooter && pageNumbers
    ? '<span style="float:right"><span class="pageNumber"></span> / <span class="totalPages"></span></span>'
    : "";
  return `<div style="font-size:8pt;color:#888;width:100%;padding:0 10mm;">${text ? escapeHtml(text) : ""}${num}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function renderPage(
  setup: (page: import("puppeteer").Page) => Promise<void>,
  opts: PdfOptions,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Block requests to private/internal hosts regardless of input mode:
    // remote HTML can embed <img src="http://169.254..."> just as easily as a URL target can redirect there.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      try {
        const u = new URL(req.url());
        if (u.protocol === "file:" || isPrivateHost(u.hostname)) {
          void req.abort();
          return;
        }
      } catch {
        // data: and about: URLs land here; they are safe to allow
      }
      void req.continue();
    });

    await setup(page);

    const margin = opts.margin ?? "18mm";
    const showHeaderFooter = Boolean(opts.headerText || opts.footerText || opts.pageNumbers);
    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: opts.printBackground ?? true,
      scale: opts.scale ?? 1,
      margin: { top: margin, bottom: margin, left: margin, right: margin },
      displayHeaderFooter: showHeaderFooter,
      headerTemplate: headerFooterTemplate(opts.headerText, false, false),
      footerTemplate: headerFooterTemplate(opts.footerText, opts.pageNumbers ?? false, true),
      timeout: 30_000,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  return renderPage(async (page) => {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
  }, opts);
}

export async function markdownToPdf(markdown: string, opts: PdfOptions = {}): Promise<Buffer> {
  const body = await md.parse(markdown, { async: true });

  // Both payloads are heavy, so they are attached only when the document actually uses them:
  // ~300KB of inlined fonts for maths, ~3.5MB of script for diagrams.
  const hasMath = body.includes("katex");
  const hasDiagram = body.includes('class="mermaid"');

  const head =
    `<meta charset="utf-8"><style>${MARKDOWN_STYLE}</style>` +
    (hasMath ? `<style>${katexCss()}</style>` : "");
  const html = `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

  if (!hasDiagram) return htmlToPdf(html, opts);

  return renderPage(async (page) => {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.addScriptTag({ path: mermaidJs });
    await page.evaluate(async () => {
      const m = (globalThis as unknown as { mermaid?: any }).mermaid;
      if (!m) return;
      m.initialize({ startOnLoad: false, theme: "neutral" });
      // suppressErrors keeps one malformed diagram from failing the whole document: the offending
      // block is left as its own source text, which is more useful than a 500.
      await m.run({ querySelector: "pre.mermaid", suppressErrors: true });
    });
    // Mermaid injects SVG synchronously once run() resolves, but web fonts inside the diagram can
    // still be settling. One frame is enough and costs a few milliseconds.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  }, opts);
}

export async function urlToPdf(url: string, opts: PdfOptions = {}): Promise<Buffer> {
  await assertPublicUrl(url);
  return renderPage(async (page) => {
    await page.goto(url, {
      waitUntil: opts.waitForNetworkIdle ? "networkidle0" : "load",
      timeout: 30_000,
    });
  }, opts);
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close().catch(() => {});
    browserPromise = null;
  }
}
