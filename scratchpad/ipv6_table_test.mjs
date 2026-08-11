/**
 * Table-driven assertions for the IPv6 parser and the private-address classifier.
 *
 * These exist because `ipv6Bytes` is security-boundary code reached from a request interceptor, and
 * the failure that matters is subtle: an invalid string must never silently become a valid address.
 * It is currently protected by a `net.isIP()` check at the caller, but a function whose correctness
 * depends on somebody else remembering to guard it is one refactor away from a hole.
 *
 *   node scratchpad/ipv6_table_test.mjs
 */
import { isIP } from "node:net";
import { ipv6Bytes, isAllowedRequestUrl } from "../dist/ssrf.js";

const hex = (b) => (b === null ? "null" : b.map((x) => x.toString(16).padStart(2, "0")).join(""));

// [input, expected bytes as hex, or null]
const parse = [
  // Canonical forms
  ["::", "00000000000000000000000000000000"],
  ["::1", "00000000000000000000000000000001"],
  ["1::", "00010000000000000000000000000000"],
  ["1::1", "00010000000000000000000000000001"],
  ["1:2:3:4:5:6:7:8", "00010002000300040005000600070008"],
  ["1:2:3:4:5:6:7::", "00010002000300040005000600070000"],
  ["::1:2:3:4:5:6:7", "00000001000200030004000500060007"],
  ["fe80::1", "fe800000000000000000000000000001"],
  ["FE80::1", "fe800000000000000000000000000001"],
  ["0000:0000:0000:0000:0000:0000:0000:0001", "00000000000000000000000000000001"],

  // Embedded IPv4, both spellings of the same address
  ["::ffff:127.0.0.1", "00000000000000000000ffff7f000001"],
  ["::ffff:7f00:1", "00000000000000000000ffff7f000001"],
  ["::1.2.3.4", "00000000000000000000000001020304"],

  // Must be rejected: parseInt would otherwise accept a valid prefix and drop the rest
  ["::ffff:1g", null],
  ["::ffff:abcdg", null],
  ["1g::1", null],
  ["::1g", null],
  ["00001::1", null],
  ["12345::1", null],

  // Must be rejected: a suffix-only dotted match would consume part of the address
  ["::ffff:1.2.3.4.5", null],
  ["::ffff:1.2.3.4x", null],
  ["::ffff:1.2.3.999", null],
  ["::ffff:1.2.3", null],
  ["::ffff:1.2.3.4.5.6", null],
  ["1.2.3.4", null],

  // Structural
  ["1::2::3", null],
  ["1:2:3:4:5:6:7:8:9", null],
  ["1:2:3:4:5:6:7", null],
  ["", null],

  // Zone indices rejected rather than stripped
  ["fe80::1%eth0", null],
  ["fe80::1%25", null],
];

let bad = 0;
console.log("  ipv6Bytes()");
for (const [input, want] of parse) {
  const got = hex(ipv6Bytes(input));
  const ok = got === (want ?? "null");
  if (!ok) bad++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${JSON.stringify(input).padEnd(44)} ${ok ? "" : `got ${got}, want ${want ?? "null"}`}`);
}

// Reachability: the classifier is only entered for addresses Node considers valid, so record which
// of the rejected forms Node would even hand over. Documents the guard rather than assuming it.
console.log("\n  net.isIP() gate on the rejected forms (0 means ipv6Bytes is never reached)");
for (const [input, want] of parse) {
  if (want !== null) continue;
  if (input === "") continue;
  console.log(`    isIP(${JSON.stringify(input).padEnd(24)}) = ${isIP(input)}`);
}

// Public addresses must stay reachable: over-blocking breaks web fonts and remote images.
const verdicts = [
  ["2001:4860:4860::8888", true, "Google DNS"],
  ["2606:4700:4700::1111", true, "Cloudflare DNS"],
  ["2620:fe::fe", true, "Quad9"],
  ["2a00:1450:4001:800::200e", true, "Google EU"],
  ["2001:0001::1", true, "public, NOT Teredo (2001:0000::/32)"],
  ["2001:0000::1", false, "Teredo"],
  ["2001:db8::1", true, "documentation range, routable as far as we care"],
  ["::1", false, "loopback"],
  ["fe80::1", false, "link-local"],
  ["fec0::1", false, "site-local"],
  ["fd00::1", false, "unique local"],
  ["ff02::1", false, "multicast"],
  ["64:ff9b::7f00:1", false, "NAT64"],
  ["::ffff:a9fe:a9fe", false, "cloud metadata, hex-mapped"],
];

console.log("\n  isAllowedRequestUrl()");
for (const [ip, shouldAllow, label] of verdicts) {
  const got = await isAllowedRequestUrl(`http://[${ip}]/`);
  const ok = got === shouldAllow;
  if (!ok) bad++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${(shouldAllow ? "allow" : "block")}  ${ip.padEnd(26)} ${label}`);
}

const total = parse.length + verdicts.length;
console.log(`\n  ${total - bad}/${total} correct`);
process.exitCode = bad === 0 ? 0 : 1;
