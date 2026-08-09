import puppeteer, { Browser } from "puppeteer";
import { marked } from "marked";
import { assertPublicUrl, isPrivateHost } from "./ssrf.js";

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
  const body = await marked.parse(markdown, { async: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${MARKDOWN_STYLE}</style></head><body>${body}</body></html>`;
  return htmlToPdf(html, opts);
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
