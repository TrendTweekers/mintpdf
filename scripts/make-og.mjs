/**
 * Build the Open Graph card, public/og.png, at 1200x630.
 *
 * Every share of this site was rendering as a bare grey rectangle because no page carried an
 * og:image. This is the one asset that fixes it everywhere.
 *
 * It is deliberately the same visual system as the site: neutral near-black, one hairline, and the
 * document as the only white object. A share preview that looks like the page it links to is worth
 * more than a prettier one that does not.
 *
 *   node scripts/make-og.mjs
 */
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; background: #0b0b0c; color: #ededf0;
    font-family: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: grid; grid-template-rows: auto 1fr auto; padding: 62px 68px;
  }
  .top { display: flex; align-items: center; gap: 13px; }
  .name { font-size: 27px; font-weight: 640; letter-spacing: -.02em; }
  .what { color: #6e6e78; font-size: 18px; padding-left: 20px;
          border-left: 1px solid #2b2b32; margin-left: 4px; }
  .mid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 56px; align-items: center; }
  h1 { font-size: 52px; line-height: 1.08; letter-spacing: -.035em; font-weight: 620;
       text-wrap: balance; }
  h1 em { font-style: normal; color: #6e6e78; }
  .sub { margin-top: 22px; color: #a1a1aa; font-size: 21px; line-height: 1.45; max-width: 22ch; }
  /* The document: the only white object, exactly as on the site. */
  .paper { background: #fbfbf9; color: #1a1a19; border-radius: 5px; padding: 24px 26px 18px;
           box-shadow: 0 24px 60px rgba(0,0,0,.55); }
  .paper h4 { font-size: 20px; font-weight: 640; letter-spacing: -.01em;
              border-bottom: 1px solid #dededa; padding-bottom: 10px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; font-size: 16px; padding: 7px 0;
         border-bottom: 1px solid #eceae5; }
  .row.h { color: #77776f; font-size: 13.5px; letter-spacing: .04em; text-transform: uppercase; }
  .pf { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 10px;
        border-top: 1px solid #dededa; color: #9a9a94; font-size: 12.5px;
        font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .bot { display: flex; align-items: center; gap: 14px; color: #6e6e78; font-size: 17px;
         border-top: 1px solid #1f1f24; padding-top: 26px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #3ce0a5; }
  .bot b { color: #3ce0a5; font-weight: 560; }
</style></head><body>

  <div class="top">
    <svg width="30" height="30" viewBox="0 0 48 48">
      <path d="M18 43V13" stroke="#ededf0" stroke-width="3" stroke-linecap="round"/>
      <path d="M18 19C18 11 25 6 35 6c0 9-7 14-17 13z" fill="#3ce0a5"/>
      <path d="M18 32c0-7 6-11 14-11 0 8-6 12-14 11z" fill="#3ce0a5" opacity=".5"/>
    </svg>
    <span class="name">MintPDF</span>
    <span class="what">HTML &amp; Markdown → PDF · MCP native</span>
  </div>

  <div class="mid">
    <div>
      <h1>Markdown in.<br><em>Finished document out.</em></h1>
      <p class="sub">A PDF API for developers and AI agents.</p>
    </div>
    <div class="paper">
      <h4>Invoice #42</h4>
      <div class="row h"><span>Item</span><span>Price</span></div>
      <div class="row"><span>Widget</span><span>$9.00</span></div>
      <div class="row"><span>Gadget</span><span>$24.00</span></div>
      <div class="pf"><span>Generated with MintPDF</span><span>1 / 1</span></div>
    </div>
  </div>

  <div class="bot">
    <span class="dot"></span>
    <span>One POST request, or one MCP tool call.</span>
    <span><b>No signup to try.</b></span>
  </div>

</body></html>`;

const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: out, type: "png" });
await browser.close();
console.log(`  wrote ${out}`);
