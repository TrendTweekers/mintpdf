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

/**
 * This suite sends more requests than the anonymous tier allows in a day, so without a key (or a
 * raised local limit) the run turns into 429s partway through. That failure mode is actively
 * dangerous here: a blocked case passes only when the response is 400, so a 429 gets reported as
 * LEAK!! against a server that is in fact refusing correctly. Reading that output sends you hunting
 * a vulnerability that does not exist, or teaches you to discount the word LEAK. Either way the
 * suite has become worse than useless.
 *
 * So fail loudly and early rather than printing a plausible wrong answer.
 *
 *   local:  ANON_DAILY_LIMIT=5000 node dist/server.js
 *   remote: BASE=https://mintpdf.dev MINTPDF_KEY=pm_... node scratchpad/ssrf_suite.mjs
 */
{
  const probe = await fetch(`${BASE}/v1/pdf`, {
    method: "POST",
    headers,
    body: JSON.stringify({ markdown: "quota preflight" }),
  });
  if (probe.status === 429) {
    console.error(
      "\n  ABORT: this client is being rate limited, so every blocked case would report LEAK!! on\n" +
        "  a 429 rather than on a real bypass. Re-run with MINTPDF_KEY, or locally with\n" +
        "  ANON_DAILY_LIMIT raised. No result is trustworthy until this preflight passes.\n",
    );
    process.exit(2);
  }
}

const blocked = [
  ["cloud metadata", { url: "http://169.254.169.254/latest/meta-data/" }],
  ["loopback", { url: "http://127.0.0.1/" }],
  ["unspecified 0.0.0.0", { url: "http://0.0.0.0/" }],
  ["RFC1918 10/8", { url: "http://10.0.0.1/" }],
  ["RFC1918 192.168/16", { url: "http://192.168.1.1/" }],
  ["RFC1918 172.16/12", { url: "http://172.16.0.1/" }],
  ["CGNAT 100.64/10", { url: "http://100.100.100.100/" }],
  ["IPv6 loopback", { url: "http://[::1]/" }],
  ["IPv6 unspecified", { url: "http://[::]/" }],
  ["IPv6 ULA", { url: "http://[fd00::1]/" }],
  ["IPv6 link-local", { url: "http://[fe80::1]/" }],
  ["IPv6 site-local (deprecated)", { url: "http://[fec0::1]/" }],
  ["IPv6 multicast", { url: "http://[ff02::1]/" }],
  ["IPv4-mapped RFC1918", { url: "http://[::ffff:10.0.0.1]/" }],
  ["IPv4-mapped metadata", { url: "http://[::ffff:169.254.169.254]/" }],
  // The same addresses spelled in hex. Text matching catches the dotted form and misses these,
  // which is exactly the bug an audit found in the first version of this check.
  ["IPv4-mapped loopback, hex", { url: "http://[::ffff:7f00:1]/" }],
  ["IPv4-mapped metadata, hex", { url: "http://[::ffff:a9fe:a9fe]/" }],
  ["IPv4-mapped RFC1918, hex", { url: "http://[::ffff:a00:1]/" }],
  ["IPv4-compatible loopback", { url: "http://[::7f00:1]/" }],
  ["NAT64 prefix", { url: "http://[64:ff9b::7f00:1]/" }],
  ["localhost name", { url: "http://localhost/" }],
  [".internal name", { url: "http://pdfmint.railway.internal/" }],
  ["public name -> loopback", { url: "http://localtest.me/" }],
  ["nip.io -> metadata", { url: "http://169.254.169.254.nip.io/" }],
  ["nip.io -> RFC1918", { url: "http://10.0.0.1.nip.io/" }],
  ["file scheme", { url: "file:///etc/passwd" }],
  ["ftp scheme", { url: "ftp://example.com/" }],
];

// A guard that also breaks ordinary rendering is a different bug, not a fix. These must all work.
const allowed = [
  ["plain markdown", { markdown: "# ok" }],
  ["public URL", { url: "https://example.com/" }],
  ["html embedding a blocked resource", { html: '<h1>ok</h1><img src="http://169.254.169.254/x">' }],
  [
    "remote web font still embeds",
    {
      html:
        "<html><head><style>@import url('https://fonts.googleapis.com/css2?family=Lobster&display=swap');" +
        "body{font-family:'Lobster',cursive;font-size:40px}</style></head><body><p>Font</p></body></html>",
    },
    (buf) => buf.includes(Buffer.from("Lobster")),
  ],
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

for (const [label, body, extra] of allowed) {
  const res = await fetch(`${BASE}/v1/pdf`, { method: "POST", headers, body: JSON.stringify(body) });
  const buf = Buffer.from(await res.arrayBuffer());
  const ok =
    res.status === 200 && buf.subarray(0, 5).toString() === "%PDF-" && (!extra || extra(buf));
  if (ok) pass++;
  console.log(`  ${ok ? "ALLOWED" : "BROKEN "}  ${label.padEnd(30)} ${res.status} ${buf.length}b`);
}

console.log(`\n  ${pass}/${total} correct`);
