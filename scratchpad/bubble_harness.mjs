/**
 * Runs the Bubble action files against the real MintPDF API.
 *
 * Targets Plugin API v4: the actions are async functions using native fetch, so the harness no
 * longer fakes the HTTP layer at all — those calls are real. The only thing stubbed is
 * context.uploadContent, which exists solely inside Bubble.
 *
 * The earlier version of this harness emulated the v3 fiber-backed context.async. That made the
 * actions pass here while failing in Bubble with "context.async is not a function", because the
 * harness was reproducing an API the platform no longer has. A test that invents its own runtime
 * proves nothing about the real one.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const work = mkdtempSync(join(tmpdir(), "bubble-"));

// Mirrors exactly what a v4 server-side action receives, read off the real runtime on 2026-08-11.
// Nothing here is invented: if a future action reaches for an API not in this object, it will fail
// here the same way it fails in Bubble.
function makeContext(apiKey) {
  return {
    currentUser: {},
    userTimezone: "Europe/Stockholm",
    keys: { api_key: apiKey },
    isBubbleThing() {},
    isBubbleList() {},
    getThingById() {},
    getThingsById() {},
    v3: { request() {}, async() {} },
  };
}

function load(file) {
  const src = readFileSync(`/home/plastgaffel/pdfmint/bubble/${file}`, "utf8");
  return new Function(`return (${src})`)();
}

const cases = [
  {
    file: "action-markdown-to-pdf.js",
    name: "Markdown with a table and page numbers",
    props: {
      markdown: "# Invoice #42\n\n| Item | Price |\n|---|---:|\n| Widget | $9.00 |\n\nThanks.",
      filename: "invoice",
      page_numbers: true,
    },
  },
  {
    file: "action-markdown-to-pdf.js",
    name: "Markdown, minimal document",
    props: { markdown: "# Hello\n\nShort doc." },
  },
  {
    file: "action-html-to-pdf.js",
    name: "HTML with header/footer, landscape Letter",
    props: {
      html: "<h1>Certificate</h1><p>Awarded to Ada Lovelace.</p>",
      filename: "cert.pdf",
      header_text: "Acme Ltd",
      footer_text: "2026",
      format: "Letter",
      landscape: true,
      margin: "12mm",
    },
  },
  {
    file: "action-url-to-pdf.js",
    name: "Public URL to PDF",
    props: { url: "https://example.com", filename: "page" },
  },
  {
    file: "action-markdown-to-pdf.js",
    name: "Empty input is rejected with a clear message",
    props: { markdown: "" },
    expectError: /Markdown field is empty/,
  },
  {
    file: "action-markdown-to-pdf.js",
    name: "A returned URL is a real, fetchable PDF",
    props: { markdown: "# Fetch me\n\n| A | B |\n|---|---|\n| 1 | 2 |" },
    verifyFetch: true,
  },
];

let pass = 0;
for (const c of cases) {
  const action = load(c.file);
  const ctx = makeContext(process.env.MINTPDF_KEY || "");
  try {
    const out = await action(c.props, ctx);
    if (c.expectError) {
      console.log(`  FAIL  ${c.name} — expected an error, got ${JSON.stringify(out)}`);
      continue;
    }
    let ok = typeof out.url === "string" && out.url.length > 0 && out.size_bytes > 0;
    if (ok && c.verifyFetch) {
      // The whole product is the file, so at least one case downloads it and checks the bytes.
      const r = await fetch(out.url);
      const buf = Buffer.from(await r.arrayBuffer());
      ok = r.ok && buf.subarray(0, 5).toString() === "%PDF-";
      console.log(`           fetched ${buf.length} bytes, valid PDF: ${buf.subarray(0, 5).toString() === "%PDF-"}`);
    }
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${c.name}\n           url=${out.url.slice(0, 56)} bytes=${out.size_bytes} stored=${out.saved_to_bubble}`,
    );
    if (ok) pass++;
  } catch (e) {
    if (c.expectError && c.expectError.test(e.message)) {
      console.log(`  PASS  ${c.name}\n           threw: ${e.message.slice(0, 68)}`);
      pass++;
    } else {
      console.log(`  FAIL  ${c.name} — ${e.message.slice(0, 150)}`);
    }
  }
}
console.log(`\n  ${pass}/${cases.length} passed   (files under ${work})`);
