/**
 * SSRF suite for the render path. Run against a live instance:
 *   BASE=https://mintpdf.dev MINTPDF_KEY=... node scratchpad/ssrf_suite.mjs
 *
 * This service renders arbitrary URLs and executes submitted JavaScript, so the interesting
 * bypasses are the ones that look public until the moment of the fetch: alternate IP encodings,
 * IPv6 and IPv4-mapped forms, public hostnames that resolve to private addresses (the DNS-rebinding
 * shape), non-http schemes, and resources embedded in HTML rather than requested directly.
 *
 * The allowed cases matter as much as the blocked ones. A guard that also breaks web fonts and
 * remote images is not a fix, it is a different bug.
 */
const BASE = process.env.BASE || "http://localhost:3400";
const KEY = process.env.MINTPDF_KEY || "";
const headers = KEY
  ? { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }
  : { "Content-Type": "application/json" };

const blocked = [
  ["cloud metadata", { url: "http://169.254.169.254/latest/meta-data/" }],
  ["loopback", { url: "http://127.0.0.1/" }],
  ["unspecified 0.0.0.0", { url: "http://0.0.0.0/" }],
  ["RFC1918 10/8", { url: "http://10.0.0.1/" }],
  ["RFC1918 192.168/16", { url: "http://192.168.1.1/" }],
  ["RFC1918 172.16/12", { url: "http://172.16.0.1/" }],
  ["CGNAT 100.64/10", { url: "http://100.100.100.100/" }],
  ["IPv6 loopback", { url: "http://[::1]/" }],
  ["IPv6 ULA", { url: "http://[fd00::1]/" }],
  ["IPv4-mapped RFC1918", { url: "http://[::ffff:10.0.0.1]/" }],
  ["IPv4-mapped metadata", { url: "http://[::ffff:169.254.169.254]/" }],
  ["localhost name", { url: "http://localhost/" }],
  [".internal name", { url: "http://pdfmint.railway.internal/" }],
  ["public name -> loopback", { url: "http://localtest.me/" }],
  ["nip.io -> metadata", { url: "http://169.254.169.254.nip.io/" }],
  ["nip.io -> RFC1918", { url: "http://10.0.0.1.nip.io/" }],
  ["file scheme", { url: "file:///etc/passwd" }],
  ["ftp scheme", { url: "ftp://example.com/" }],
];

const allowed = [
  ["plain markdown", { markdown: "# ok" }],
  ["public URL", { url: "https://example.com/" }],
  ["html embedding a blocked resource", { html: '<h1>ok</h1><img src="http://169.254.169.254/x">' }],
];

let pass = 0;
const total = blocked.length + allowed.length;

for (const [label, body] of blocked) {
  const res = await fetch(`${BASE}/v1/pdf`, { method: "POST", headers, body: JSON.stringify(body) });
  const ok = res.status === 400;
  if (ok) pass++;
  let detail = `EXPECTED 400, GOT ${res.status}`;
  if (ok) {
    try {
      detail = (await res.json()).error;
    } catch {
      detail = "(400)";
    }
  }
  console.log(`  ${ok ? "BLOCKED" : "LEAK!! "}  ${label.padEnd(26)} ${detail}`);
}

for (const [label, body] of allowed) {
  const res = await fetch(`${BASE}/v1/pdf`, { method: "POST", headers, body: JSON.stringify(body) });
  const buf = Buffer.from(await res.arrayBuffer());
  const ok = res.status === 200 && buf.subarray(0, 5).toString() === "%PDF-";
  if (ok) pass++;
  console.log(`  ${ok ? "ALLOWED" : "BROKEN "}  ${label.padEnd(26)} ${res.status} ${buf.length}b`);
}

console.log(`\n  ${pass}/${total} correct`);
