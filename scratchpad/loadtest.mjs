/**
 * Fires N concurrent renders at a running instance and reports what actually happened.
 *
 * The question is not "how fast is it" but "what does it do when overwhelmed". A healthy result is
 * every request either succeeding or being refused promptly with 503 + Retry-After. An unhealthy
 * result is timeouts, hangs, or the process dying, because that is what a Hacker News front page
 * would produce without admission control.
 */
const BASE = process.env.BASE || "http://localhost:3300";
const N = Number(process.env.N || 30);

const body = JSON.stringify({
  markdown:
    "# Load test\n\n| Item | Qty | Price |\n|---|---:|---:|\n" +
    Array.from({ length: 40 }, (_, i) => `| Row ${i} | ${i} | $${i}.00 |`).join("\n"),
  pageNumbers: true,
});

const started = Date.now();
const results = await Promise.all(
  Array.from({ length: N }, async (_, i) => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/v1/pdf`, {
        method: "POST",
        headers: process.env.MINTPDF_KEY
          ? { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MINTPDF_KEY}` }
          : { "Content-Type": "application/json" },
        body,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        i,
        status: res.status,
        ms: Date.now() - t0,
        retryAfter: res.headers.get("retry-after"),
        validPdf: buf.subarray(0, 5).toString() === "%PDF-",
        bytes: buf.length,
      };
    } catch (e) {
      return { i, status: "NETWORK", ms: Date.now() - t0, error: e.message.slice(0, 60) };
    }
  }),
);

const wall = Date.now() - started;
const by = {};
for (const r of results) by[r.status] = (by[r.status] || 0) + 1;

const ok = results.filter((r) => r.status === 200);
const busy = results.filter((r) => r.status === 503);
const bad = results.filter((r) => r.status !== 200 && r.status !== 503);
const times = ok.map((r) => r.ms).sort((a, b) => a - b);

console.log(`\n  ${N} concurrent renders against ${BASE}`);
console.log(`  wall clock        : ${(wall / 1000).toFixed(1)}s`);
console.log(`  status counts     : ${JSON.stringify(by)}`);
console.log(`  all 200s are PDFs : ${ok.every((r) => r.validPdf)}`);
if (times.length) {
  console.log(
    `  succeeded (ms)    : min ${times[0]} / median ${times[Math.floor(times.length / 2)]} / max ${times[times.length - 1]}`,
  );
}
if (busy.length) {
  console.log(`  refused fast      : ${busy.length}, slowest ${Math.max(...busy.map((r) => r.ms))}ms, Retry-After ${busy[0].retryAfter}s`);
}
if (bad.length) {
  console.log(`  UNHEALTHY         : ${bad.length} ->`, bad.slice(0, 3));
}
console.log(
  `\n  verdict: ${bad.length === 0 ? "healthy — every request was answered, none hung or errored" : "PROBLEM — see UNHEALTHY above"}`,
);
