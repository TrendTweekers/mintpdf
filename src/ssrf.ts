import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/**
 * Expand any IPv6 literal to its 16 bytes.
 *
 * Matching IPv6 with string prefixes is a trap: the same address has many spellings, and the two
 * that matter here are `::ffff:127.0.0.1` and `::ffff:7f00:1`, which are the same address written
 * two ways. Comparing text would catch one and miss the other. Working from the bytes makes the
 * spelling irrelevant.
 */
function ipv6Bytes(ip: string): number[] | null {
  let s = ip.toLowerCase();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  s = s.split("%")[0]; // drop any zone index

  let tail: number[] = [];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const parts = dotted[1].split(".").map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    tail = parts;
    s = s.slice(0, s.length - dotted[1].length).replace(/:$/, "") || "::";
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toWords = (part: string) =>
    part
      .split(":")
      .filter((x) => x !== "")
      .map((x) => parseInt(x, 16));
  const head = toWords(halves[0] ?? "");
  const rest = halves.length === 2 ? toWords(halves[1]) : [];
  if ([...head, ...rest].some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;

  const bytesOf = (words: number[]) => words.flatMap((w) => [(w >> 8) & 0xff, w & 0xff]);
  const headB = bytesOf(head);
  const restB = [...bytesOf(rest), ...tail];
  const total = 16;
  if (halves.length === 2) {
    const fill = total - headB.length - restB.length;
    if (fill < 0) return null;
    return [...headB, ...Array(fill).fill(0), ...restB];
  }
  const all = [...headB, ...restB];
  return all.length === total ? all : null;
}

function isPrivateIp(ip: string): boolean {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  if (isIP(bare) === 6) {
    const b = ipv6Bytes(bare);
    if (!b) return true; // unparseable: refuse rather than guess
    // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible: judge by the embedded v4 address, whichever
    // way it was spelled.
    const isMapped = b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff;
    const isCompat = b.slice(0, 12).every((x) => x === 0);
    if (isMapped || isCompat) return isPrivateIp(b.slice(12).join("."));
    if (b.every((x) => x === 0)) return true; // ::
    if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true; // ::1
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true; // fec0::/10 site-local (deprecated)
    if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
    if (b[0] === 0xff) return true; // ff00::/8 multicast
    // 64:ff9b::/96 is the NAT64 translation prefix: the first word is 0x0064, so these bytes sit at
    // offsets 1-3, not 0-2. Blocked outright rather than unwrapping the embedded v4, because a
    // NAT64 address has no business appearing in a document we are asked to render.
    if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return true;
    if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00) return true; // 2001:0::/32 Teredo
    return false;
  }
  return PRIVATE_V4.some((re) => re.test(bare));
}

/**
 * Whether a URL Chromium is about to fetch may proceed.
 *
 * The page-level check cannot rely on hostnames alone. Validation resolves the submitted URL once,
 * but Chromium resolves again when it actually fetches, so a record with a short TTL could answer
 * public at validation and private at fetch. Resolving here, immediately before the request is
 * allowed, narrows that to a race between this lookup and Chromium's own, rather than a window an
 * attacker can wait out. It does not eliminate it: closing it fully means pinning the resolved
 * address at the socket layer, which is not implemented.
 *
 * Fails closed. A name that will not resolve is refused rather than passed through.
 */
/**
 * Only negative results are cached, and that asymmetry is the whole point.
 *
 * Caching "this host is public" for any length of time reopens exactly the hole this function
 * exists to close: a record can answer public once, get cached, and then point somewhere private
 * for the rest of the window. Caching "this host is private" is safe, because the cached answer is
 * the refusal, and a host that turns benign later is merely blocked for a while longer.
 */
const blockedCache = new Map<string, number>();
const BLOCKED_TTL_MS = 60_000;

export async function isAllowedRequestUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Fail closed. A URL this function cannot parse is one it cannot vouch for, and the schemes
    // that legitimately reach here (data:, about:, blob:) all parse fine.
    return false;
  }

  // Allowlist rather than blocklist: ftp:, ws:, chrome-extension: and friends have no business here.
  if (url.protocol === "data:" || url.protocol === "about:" || url.protocol === "blob:") return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // WHATWG keeps the brackets on an IPv6 hostname, and isIP() rejects the bracketed form. Left
  // as-is, every IPv6 literal falls through to a DNS lookup that fails and is refused: correct by
  // accident for private addresses, wrong for public ones, and fragile either way. Strip them so
  // the address is judged as an address.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isPrivateHost(host)) return false;
  if (isIP(host)) return !isPrivateIp(host);

  const blockedAt = blockedCache.get(host);
  if (blockedAt !== undefined && Date.now() - blockedAt < BLOCKED_TTL_MS) return false;

  let isPrivate: boolean;
  try {
    const addrs = await lookup(host, { all: true });
    isPrivate = addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address));
  } catch {
    isPrivate = true;
  }
  if (isPrivate) blockedCache.set(host, Date.now());
  return !isPrivate;
}

export function isPrivateHost(hostname: string): boolean {
  // WHATWG keeps the brackets on an IPv6 hostname and isIP() rejects that form, so without this
  // strip every IPv6 literal is treated as a name and judged by DNS instead of by its bytes.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (isIP(h)) return isPrivateIp(h);
  return false; // non-IP hostnames are resolved and re-checked in assertPublicUrl
}

export async function assertPublicUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error("invalid url"), { statusCode: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Object.assign(new Error("only http/https urls are supported"), { statusCode: 400 });
  }
  if (isPrivateHost(url.hostname)) {
    throw Object.assign(new Error("url resolves to a private address"), { statusCode: 400 });
  }
  if (!isIP(url.hostname)) {
    let addrs;
    try {
      addrs = await lookup(url.hostname, { all: true });
    } catch {
      throw Object.assign(new Error("hostname does not resolve"), { statusCode: 400 });
    }
    if (addrs.some((a) => isPrivateIp(a.address))) {
      throw Object.assign(new Error("url resolves to a private address"), { statusCode: 400 });
    }
  }
}
