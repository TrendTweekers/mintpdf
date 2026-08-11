import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    // An IPv4-mapped address carries a v4 address inside a v6 one, so ::ffff:10.0.0.1 must be
    // judged by the v4 rules. Checking only ::ffff:127. would have let the whole RFC1918 range and
    // the cloud metadata address through in mapped form.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return PRIVATE_V4.some((re) => re.test(mapped[1]));
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fe80:") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd")
    );
  }
  return PRIVATE_V4.some((re) => re.test(ip));
}

/**
 * Whether a URL Chromium is about to fetch may proceed.
 *
 * The page-level check cannot rely on hostnames alone. Validation resolves the submitted URL once,
 * but Chromium resolves again when it actually fetches, so a record with a short TTL could answer
 * public at validation and private at fetch. Resolving here, at request time, closes that window:
 * whatever the name says, the address is checked immediately before the request is allowed.
 *
 * Fails closed. A name that will not resolve is refused rather than passed through.
 */
const resolveCache = new Map<string, { private: boolean; at: number }>();
const RESOLVE_TTL_MS = 30_000;

export async function isAllowedRequestUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true; // data: and about: are parsed elsewhere or harmless
  }

  // Allowlist rather than blocklist: ftp:, ws:, chrome-extension: and friends have no business here.
  if (url.protocol === "data:" || url.protocol === "about:" || url.protocol === "blob:") return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (isPrivateHost(host)) return false;
  if (isIP(host)) return !isPrivateIp(host);

  const hit = resolveCache.get(host);
  if (hit && Date.now() - hit.at < RESOLVE_TTL_MS) return !hit.private;

  let isPrivate: boolean;
  try {
    const addrs = await lookup(host, { all: true });
    isPrivate = addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address));
  } catch {
    isPrivate = true;
  }
  resolveCache.set(host, { private: isPrivate, at: Date.now() });
  return !isPrivate;
}

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
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
