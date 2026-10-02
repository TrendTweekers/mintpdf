---
slug: headless-chrome-pdf-fonts
title: Fonts missing in Puppeteer PDFs: every cause and fix
description: Your Puppeteer PDF used the wrong font or printed boxes instead of emoji. Five causes, each tested in headless Chrome, and each fix.
date: 2026-10-02
---

The PDF looks right on your laptop. On the server it comes out in a different typeface, or your
emoji turn into empty boxes, or a heading that should be in your brand font is plain Arial. No
error, no warning, nothing in the logs.

Headless Chrome never fails on a missing font. It picks a fallback and carries on. That is why
font problems in PDFs survive to production: there is nothing to catch. Here are the five causes
I could reproduce in Chrome 148, and the fix for each one.

## First, find out which font was actually used

Guessing wastes time. Chrome will tell you which real font it used for an element, through the
DevTools protocol:

```js
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(`<h1 style="font-family: Inter, sans-serif">Shipped ✅ 東京</h1>`);

const cdp = await page.createCDPSession();
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument");
const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "h1" });
const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
console.log(fonts.map((f) => `${f.familyName}: ${f.glyphCount} glyphs`));

await browser.close();
```

On my machine, which has no Inter installed, that printed:

```text
[
  'Liberation Sans: 9 glyphs',
  'Noto Color Emoji: 1 glyphs',
  'WenQuanYi Zen Hei: 2 glyphs'
]
```

So Inter was never used. Chrome took Liberation Sans for the Latin text, a colour emoji font for
the tick, and a CJK font for the two Japanese characters. To check the finished file instead,
`pdffonts` from poppler-utils lists every font embedded in a PDF.

One limit: this shows which font Chrome chose, not whether that font had the glyph. On a machine
with no emoji font, it reported DejaVu Sans for every character, including the emoji it then drew
as an empty box. For missing glyphs, look at the output.

## Cause 1: the font is not installed on the server

`font-family: Inter` only works if a font called Inter exists where Chromium runs. Your Mac has it.
A slim Docker image almost certainly does not.

Worse, the fallback is not what you expect. In my test, `font-family: "Inter"` with nothing after
it came out in **Liberation Serif**, because the browser default is a serif. A sans-serif design
turned into a serif one. Always end the stack with a generic family, so the fallback at least has
the right shape:

```css
body { font-family: Inter, system-ui, sans-serif; }
```

The real fix is to put the font on the machine. In a Debian-based image, copy the files into a font
directory and rebuild the font cache:

```dockerfile
COPY fonts/ /usr/share/fonts/truetype/brand/
RUN fc-cache -f
```

Do this before the browser starts. I tested the same mechanism by installing a TTF into
`~/.local/share/fonts` and running `fc-cache -f`: a fresh Chromium then used it by name with no
`@font-face` at all.

## Cause 2: no emoji or CJK font at all

This one does not even give you a wrong font. It gives you boxes. I rendered `Shipped ✅ 東京 Zürich`
with Chrome limited to the DejaVu fonts, which is roughly what a minimal image has. The Latin text,
including the ü, was fine. The emoji and both Japanese characters came out as empty rectangles.

On Debian or Ubuntu, two packages fix it:

```bash
apt-get install -y --no-install-recommends fonts-noto-color-emoji fonts-noto-cjk
```

`fonts-noto-cjk` is large, but if any user can type a name into your system, someone will eventually
type one that needs it. The full list of packages a headless Chrome image needs is in
[How to generate a PDF in a GitHub Action](/guides/pdf-github-action).

## Cause 3: the font server does not send CORS headers

Web fonts are fetched with CORS. If your page is loaded with `page.setContent()`, its origin is
`about:blank`, so every font file is a cross-origin request. When the font server does not send
`Access-Control-Allow-Origin`, Chrome discards the font and uses the fallback.

I served the same `.woff2` file from a local server twice, once with the header and once without.
With it, the PDF embedded the font. Without it, the PDF used Liberation Sans in every run,
whichever wait strategy I used. Google Fonts sends the header, which is why it works. A font on your
own CDN or S3 bucket often does not.

Either add the header on the font host, or remove the network from the problem (see the last
section).

## Cause 4: font-display: optional

`font-display: optional` tells the browser to use a web font only if it is ready almost at once,
and to never swap it in later. That is a reasonable choice for a web page. For a PDF it means the
font is never used.

I tested every `font-display` value with a font that took one second to arrive. `auto`, `block`,
`swap` and `fallback` all ended up with the right font in the PDF. `optional` printed the fallback
every time, even with no delay at all on the font server, and even after waiting for
`document.fonts.ready`. If your CSS, or a Google Fonts URL with `&display=optional`, uses it,
change it to `swap` for anything you print.

## Cause 5: the font is only used in your print styles

This one is subtle. Suppose the screen design uses one font and a print rule switches headings to
another:

```css
@media print {
  h1 { font-family: Brand, sans-serif; }
}
```

When the page loads, it is laid out for the screen. Nothing on screen uses `Brand`, so the browser
never downloads it. When `page.pdf()` switches to print media, the font is needed but not loaded,
and the heading prints in the fallback. In my tests that happened on every run, with
`waitUntil: "load"`, with `"networkidle0"`, and after `document.fonts.ready`. All three waits
finished before the font had even been requested.

The fix is to lay the page out in print mode before you wait:

```js
await page.emulateMediaType("print");
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: "out.pdf" });
```

Now the print rules apply during load, the font is requested, and `document.fonts.ready` waits for
it. Calling `document.fonts.load("1em Brand")` before `page.pdf()` also worked, if you would rather
name the font.

A related detail: if you load only the regular weight and use it in a bold heading, Chrome makes a
synthetic bold. It printed and the text was still searchable, but it is drawn by thickening the
regular glyphs, which looks heavier than a real bold. Load each weight you use.

## The fix that removes most of these: embed the font

Causes 3, 4 and part of 1 have the same root. The renderer has to fetch the font, and that can fail
without a sound. Put the font inside the HTML and there is nothing to fetch:

```js
import { readFileSync } from "node:fs";

const brand = readFileSync("fonts/Brand-Regular.woff2").toString("base64");

const css = `
  @font-face {
    font-family: Brand;
    src: url(data:font/woff2;base64,${brand}) format("woff2");
    font-weight: 400;
  }
  body { font-family: Brand, sans-serif; }
`;
```

The font is part of the document, so CORS, network timing and the font server's uptime are not
involved. In my test the PDF embedded the font even with `waitUntil: "domcontentloaded"`. A Latin
subset woff2 is often 20 to 50KB, so for an invoice or a report the cost is small. Base64 makes it
about a third larger.

## Or let a hosted renderer handle the machine

Causes 1 and 2 are about what is installed on the machine that runs Chromium. If you would rather
not maintain that machine, [MintPDF](/) runs Chromium with emoji and CJK fonts already installed, and
loads web fonts from public URLs. This request, with a Google Fonts link in the HTML, came back with
Lobster embedded in the PDF:

```bash
curl -X POST https://mintpdf.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"html":"<link href=\"https://fonts.googleapis.com/css2?family=Lobster&display=swap\" rel=\"stylesheet\"><style>body{font-family:Lobster,sans-serif;font-size:28px}</style><p>Hello from a web font</p>"}' \
  --output fonts.pdf
```

The same rules apply there: send the CORS header from your font host, do not use `optional`, and
base64 is the safe choice when the font is private. For Markdown, the
[Markdown to PDF converter](/markdown-to-pdf) uses a system font stack, so it needs none of this.
