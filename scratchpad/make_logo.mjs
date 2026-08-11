/**
 * Render public/mark.svg to a 400x400 PNG, which is what the Cline MCP Marketplace requires.
 *
 * Uses the Chromium we already ship for PDF rendering, so there is no new dependency for a
 * once-a-year task. The mark is drawn on the brand background rather than transparent, because a
 * dark-green glyph on a transparent square disappears against a dark listing page.
 */
import { readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer";

const svg = readFileSync(new URL("../public/mark.svg", import.meta.url), "utf8");

const html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:400px;height:400px}
  body{display:flex;align-items:center;justify-content:center;background:#0a0e0c}
  svg{width:260px;height:260px}
</style>
${svg}`;

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 400, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
const out = new URL("../public/logo-400.png", import.meta.url);
await page.screenshot({ path: out, type: "png" });
await browser.close();

const bytes = readFileSync(out);
// PNG header carries the dimensions at a fixed offset; assert rather than trust the viewport.
const w = bytes.readUInt32BE(16);
const h = bytes.readUInt32BE(20);
console.log(`  wrote public/logo-400.png  ${bytes.length} bytes  ${w}x${h}`);
if (w !== 400 || h !== 400) {
  console.log("  FAIL: not 400x400");
  process.exitCode = 1;
}
