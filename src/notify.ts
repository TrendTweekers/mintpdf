import { onceToday } from "./store.js";

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

export { escapeHtml };
