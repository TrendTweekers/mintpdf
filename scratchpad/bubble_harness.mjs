/**
 * Runs the Bubble action files against the real MintPDF API.
 *
 * Bubble's context.async appears synchronous because their runtime uses fibers. Plain Node cannot
 * block, so the shim below performs each HTTP call synchronously with curl and invokes the callback
 * before returning. That reproduces the ordering the real platform gives the action code, which is
 * what we need in order to trust the result.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const work = mkdtempSync(join(tmpdir(), "bubble-"));

function makeContext(apiKey) {
  return {
    keys: { api_key: apiKey },

    async(fn) {
      let result, error, called = false;
      fn((err, res) => {
        called = true;
        error = err;
        result = res;
      });
      if (!called) throw new Error("harness: callback was not invoked synchronously");
      if (error) throw error;
      return result;
    },

    request(options, cb) {
      const bodyFile = join(work, "body.bin");
      const args = [
        "-s", "-X", options.method || "GET", options.uri,
        "-o", bodyFile,
        "-w", "%{http_code}",
        "--max-time", "90",
      ];
      for (const [k, v] of Object.entries(options.headers || {})) args.push("-H", `${k}: ${v}`);
      if (options.body) args.push("--data-binary", options.body);
      let status;
      try {
        status = Number(execFileSync("curl", args, { encoding: "utf8" }).trim());
      } catch (e) {
        return cb(e);
      }
      const raw = readFileSync(bodyFile);
      // encoding:null means the caller wants a Buffer; otherwise request() would hand back a string.
      const body = options.encoding === null ? raw : raw.toString("utf8");
      cb(null, { statusCode: status, headers: {} }, body);
    },

    uploadContent(name, base64, cb) {
      const bytes = Buffer.from(base64, "base64");
      const path = join(work, name);
      writeFileSync(path, bytes);
      cb(null, `https://fake-bubble-storage.test/${name}`);
      return path;
    },
  };
}

function load(file) {
  const src = readFileSync(`/home/plastgaffel/pdfmint/bubble/${file}`, "utf8");
  return new Function(`return (${src})`)();
}

const cases = [
  {
    file: "action-markdown-to-pdf.js",
    name: "Markdown, saved to Bubble storage",
    props: {
      markdown: "# Invoice #42\n\n| Item | Price |\n|---|---:|\n| Widget | $9.00 |\n\nThanks.",
      filename: "invoice",
      page_numbers: true,
      save_to_bubble: true,
    },
  },
  {
    file: "action-markdown-to-pdf.js",
    name: "Markdown, link instead of stored file",
    props: { markdown: "# Hello\n\nShort doc.", save_to_bubble: false },
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
      save_to_bubble: true,
    },
  },
  {
    file: "action-url-to-pdf.js",
    name: "Public URL to PDF",
    props: { url: "https://example.com", filename: "page", save_to_bubble: true },
  },
  {
    file: "action-markdown-to-pdf.js",
    name: "Empty input is rejected with a clear message",
    props: { markdown: "", save_to_bubble: true },
    expectError: /Markdown field is empty/,
  },
];

let pass = 0;
for (const c of cases) {
  const action = load(c.file);
  const ctx = makeContext("");
  try {
    const out = action(c.props, ctx);
    if (c.expectError) {
      console.log(`  FAIL  ${c.name} — expected an error, got ${JSON.stringify(out)}`);
      continue;
    }
    const ok = typeof out.url === "string" && out.url.length > 0 && out.size_bytes > 0;
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${c.name}\n           url=${out.url.slice(0, 58)} bytes=${out.size_bytes} stored=${out.saved_to_bubble}`,
    );
    if (ok) pass++;
  } catch (e) {
    if (c.expectError && c.expectError.test(e.message)) {
      console.log(`  PASS  ${c.name}\n           threw: ${e.message.slice(0, 70)}`);
      pass++;
    } else {
      console.log(`  FAIL  ${c.name} — ${e.message.slice(0, 140)}`);
    }
  }
}
console.log(`\n  ${pass}/${cases.length} passed   (files written under ${work})`);
