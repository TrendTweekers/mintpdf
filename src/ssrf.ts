import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("::ffff:127.");
  }
  return PRIVATE_V4.some((re) => re.test(ip));
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
