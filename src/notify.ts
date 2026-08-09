import { onceToday } from "./store.js";

/** True the first time today for this key; use when you need to act before notifying. */
export function firstToday(key: string): boolean {
  return onceToday(`notify:${key}`);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

export const notifyEnabled = Boolean(TOKEN && CHAT_ID);

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

/** Fire-and-forget: a notification must never slow down or break a request. */
export function notify(text: string): void {
  if (!notifyEnabled) return;
  fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => {
    // never surface notification failures to the caller
  });
}

/** Sends at most one message per key per day, so quiet signals stay quiet. */
export function notifyOnce(dedupeKey: string, text: string): void {
  if (!notifyEnabled) return;
  if (!onceToday(`notify:${dedupeKey}`)) return;
  notify(text);
}

/** Two-letter country code to flag emoji (regional indicator pair). */
function flagOf(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * Where is this visitor? Cloudflare's header is free and instant when the proxy is on;
 * otherwise fall back to a free lookup. Never throws, never blocks the request.
 */
export async function locate(ip: string, cfCountry?: string): Promise<string> {
  if (cfCountry && /^[A-Za-z]{2}$/.test(cfCountry)) return `${flagOf(cfCountry)} ${cfCountry.toUpperCase()}`;
  if (!ip || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1)/.test(ip)) return "";
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,country,city`, {
      signal: AbortSignal.timeout(2500),
    });
    const d = (await res.json()) as { success?: boolean; country_code?: string; country?: string; city?: string };
    if (!d.success || !d.country_code) return "";
    const where = [d.city, d.country].filter(Boolean).join(", ");
    return `${flagOf(d.country_code)} ${where || d.country_code}`;
  } catch {
    return "";
  }
}

export { escapeHtml };
