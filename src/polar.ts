import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.polar.sh/v1";
const TOKEN = process.env.POLAR_ACCESS_TOKEN ?? "";
const PRODUCT_ID = process.env.POLAR_PRODUCT_ID ?? "";
const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET ?? "";

export const billingEnabled = Boolean(TOKEN && PRODUCT_ID);

/** Creates a hosted checkout tied to a specific API key, so the webhook knows what to upgrade. */
export async function createCheckout(opts: {
  apiKey: string;
  email: string;
  successUrl: string;
}): Promise<string> {
  const res = await fetch(`${API}/checkouts/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [PRODUCT_ID],
      customer_email: opts.email,
      success_url: opts.successUrl,
      metadata: { api_key: opts.apiKey },
    }),
  });
  if (!res.ok) {
    // Surface Polar's own validation message (e.g. an unroutable email domain) instead of a blank failure.
    let reason = `${res.status}`;
    try {
      const body = (await res.json()) as { detail?: Array<{ msg?: string }> | string };
      if (typeof body.detail === "string") reason = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) reason = body.detail[0].msg as string;
    } catch {
      // non-JSON error body; keep the status code
    }
    throw Object.assign(new Error(reason), { userFacing: true });
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("polar checkout returned no url");
  return data.url;
}

/**
 * Standard Webhooks signature check (the scheme Polar uses).
 * Signed content is `id.timestamp.body`; the secret is base64 after the `whsec_` prefix.
 */
export function verifyWebhook(rawBody: string, headers: Record<string, unknown>): boolean {
  if (!WEBHOOK_SECRET) return false;
  const id = String(headers["webhook-id"] ?? "");
  const timestamp = String(headers["webhook-timestamp"] ?? "");
  const signatureHeader = String(headers["webhook-signature"] ?? "");
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject anything older than five minutes, so a captured request can't be replayed.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  // Header may carry several space-separated versioned signatures.
  return signatureHeader.split(" ").some((part) => {
    const sig = part.startsWith("v1,") ? part.slice(3) : part;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export interface PolarEvent {
  type: string;
  data: {
    id?: string;
    metadata?: Record<string, unknown>;
    customer?: { id?: string; email?: string };
    customer_id?: string;
    subscription_id?: string;
    checkout?: { metadata?: Record<string, unknown> };
  };
}

/** Digs the API key out of wherever Polar attached it for this event shape. */
export function apiKeyFromEvent(evt: PolarEvent): string | undefined {
  const candidates = [evt.data.metadata?.api_key, evt.data.checkout?.metadata?.api_key];
  for (const c of candidates) if (typeof c === "string" && c.startsWith("pm_")) return c;
  return undefined;
}
