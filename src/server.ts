import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { htmlToPdf, markdownToPdf, urlToPdf, closeBrowser, PdfOptions } from "./pdf.js";
import {
  LIMITS, consumeQuota, createKey, getKey, findKeyByEmail, findKeyBySubscription,
  setTier, dailyLimitFor, readPdf, storePdf,
} from "./store.js";
import { billingEnabled, createCheckout, verifyWebhook, apiKeyFromEvent, PolarEvent } from "./polar.js";
import { handleMcpRequest } from "./mcp.js";
import { getPost, getPosts, renderIndex, renderPost, renderSitemap } from "./blog.js";
import { notify, notifyOnce, notifyEnabled, escapeHtml, locate, firstToday } from "./notify.js";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
/** Set once a custom domain is live; every other host 301s here so early links keep their value. */
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "";

const app = Fastify({
  logger: true,
  bodyLimit: 5 * 1024 * 1024,
  trustProxy: true,
});

// Keep the raw JSON around: webhook signatures are computed over the exact bytes sent.
app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
  (req as unknown as { rawBody?: string }).rawBody = body as string;
  try {
    done(null, body === "" ? {} : JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

await app.register(fastifyStatic, {
  root: join(dirname(fileURLToPath(import.meta.url)), "..", "public"),
});

// Consolidate SEO signal on one hostname once a custom domain exists.
app.addHook("onRequest", async (req, reply) => {
  if (!CANONICAL_HOST) return;
  const host = String(req.headers.host ?? "");
  if (host && host !== CANONICAL_HOST && req.method === "GET") {
    return reply.code(301).redirect(`https://${CANONICAL_HOST}${req.url}`);
  }
});

app.post<{ Body: { path?: string; ref?: string } }>("/v1/beacon", async (req, reply) => {
  reply.code(204).send();
  if (!notifyEnabled) return;
  const ua = String(req.headers["user-agent"] ?? "");
  if (/bot|crawler|spider|preview|monitor|curl|headless/i.test(ua)) return;
  if (!firstToday(`visit:${req.ip}`)) return;
  const path = String(req.body?.path ?? "/").slice(0, 120);
  const ref = String(req.body?.ref ?? "").slice(0, 200);
  const where = await locate(req.ip, String(req.headers["cf-ipcountry"] ?? ""));
  notify(
    `👀 <b>Visitor</b>` + (where ? `  ${where}` : "") +
      `\n${escapeHtml(path)}` +
      (ref ? `\nfrom: ${escapeHtml(ref)}` : "\nfrom: direct"),
  );
});

interface PdfBody extends PdfOptions {
  html?: string;
  markdown?: string;
  url?: string;
  output?: "pdf" | "url";
}

function rateLimit(req: { headers: Record<string, unknown>; ip: string }): { ok: boolean; remaining: number; keyed: boolean } {
  const auth = String(req.headers.authorization ?? "");
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const record = presented ? getKey(presented) : undefined;
  if (record) {
    const remaining = consumeQuota(`key:${record.key}`, dailyLimitFor(record.tier), "month");
    return { ok: remaining >= 0, remaining, keyed: true };
  }
  const remaining = consumeQuota(`ip:${req.ip}`, LIMITS.anonymousPerDay);
  return { ok: remaining >= 0, remaining, keyed: false };
}

app.post<{ Body: PdfBody }>("/v1/pdf", async (req, reply) => {
  const quota = rateLimit(req);
  reply.header("x-ratelimit-remaining", String(Math.max(quota.remaining, 0)));
  if (!quota.ok) {
    notifyOnce(
      `limit:${quota.keyed ? String(req.headers.authorization).slice(-8) : req.ip}`,
      `🚦 <b>Limit reached</b>\n${quota.keyed ? "a keyed user" : "an anonymous visitor"} hit the cap`,
    );
    return reply.code(429).send({
      error: "daily limit reached",
      hint: quota.keyed
        ? "Monthly limit reached for this key. Upgrade at /#pricing for a higher limit."
        : `Anonymous trial is ${LIMITS.anonymousPerDay}/day. POST /v1/keys {\"email\":\"you@example.com\"} for a free key (${LIMITS.free}/month).`,
    });
  }

  const body = req.body ?? ({} as PdfBody);
  const sources = [body.html, body.markdown, body.url].filter((s) => typeof s === "string" && s.length > 0);
  if (sources.length !== 1) {
    return reply.code(400).send({ error: "provide exactly one of html, markdown, url" });
  }

  let pdf: Buffer;
  try {
    if (body.html) pdf = await htmlToPdf(body.html, body);
    else if (body.markdown) pdf = await markdownToPdf(body.markdown, body);
    else pdf = await urlToPdf(body.url as string, { ...body, waitForNetworkIdle: true });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.code(e.statusCode ?? 500).send({ error: e.message });
  }

  const source = body.html ? "html" : body.markdown ? "markdown" : "url";
  notifyOnce(
    `render:${quota.keyed ? "key" : "ip"}:${quota.keyed ? String(req.headers.authorization).slice(-8) : req.ip}`,
    `📄 <b>PDF rendered</b>\nsource: ${source} · ${quota.keyed ? "keyed" : "anonymous"}\n` +
      `size: ${Math.round(pdf.length / 1024)} KB`,
  );

  if (body.output === "url") {
    const { id, expiresAt } = storePdf(pdf);
    return reply.send({ download_url: `${BASE_URL}/f/${id}`, expires_at: expiresAt, size_bytes: pdf.length });
  }
  return reply.header("content-type", "application/pdf").send(pdf);
});

app.post<{ Body: { email?: string } }>("/v1/keys", async (req, reply) => {
  const email = (req.body?.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return reply.code(400).send({ error: "valid email required" });
  }
  const ipQuota = consumeQuota(`keygen:${req.ip}`, 3);
  if (ipQuota < 0) return reply.code(429).send({ error: "too many keys requested today" });
  const key = createKey(email);
  notify(`🔑 <b>New free key</b>\n${escapeHtml(email)}`);
  return reply.send({ key, daily_limit: LIMITS.free });
});

app.get<{ Params: { id: string } }>("/f/:id", async (req, reply) => {
  const pdf = readPdf(req.params.id);
  if (!pdf) return reply.code(404).send({ error: "not found or expired" });
  return reply
    .header("content-type", "application/pdf")
    .header("content-disposition", 'inline; filename="document.pdf"')
    .send(pdf);
});

// MCP endpoint (streamable HTTP, stateless). GET/DELETE are not used in stateless mode.
app.post("/mcp", async (req, reply) => {
  // Only meter actual tool invocations; initialize/tools-list handshakes stay free.
  const isToolCall = (req.body as { method?: string } | null)?.method === "tools/call";
  const quota = isToolCall ? rateLimit(req) : { ok: true };
  if (!quota.ok) {
    return reply.code(429).send({
      jsonrpc: "2.0",
      error: { code: -32000, message: "daily limit reached; POST /v1/keys for a free key" },
      id: null,
    });
  }
  reply.hijack();
  await handleMcpRequest(BASE_URL, req.raw, reply.raw, req.body);
});
app.get("/mcp", async (_req, reply) => reply.code(405).send({ error: "POST only (stateless transport)" }));

app.post<{ Body: { key?: string } }>("/v1/upgrade", async (req, reply) => {
  if (!billingEnabled) return reply.code(503).send({ error: "billing not configured yet" });
  const presented = (req.body?.key ?? "").trim();
  const record = getKey(presented);
  if (!record) return reply.code(404).send({ error: "unknown key. Get a free key first, then upgrade it." });
  if (record.tier === "solo") return reply.send({ already_subscribed: true });
  try {
    const url = await createCheckout({
      apiKey: record.key,
      email: record.email,
      successUrl: `${BASE_URL}/upgrade/done`,
    });
    notify(`💳 <b>Checkout started</b>\n${escapeHtml(record.email)} · $19/mo`);
    return reply.send({ checkout_url: url });
  } catch (err) {
    req.log.error(err);
    const e = err as Error & { userFacing?: boolean };
    return reply.code(502).send({ error: e.userFacing ? e.message : "could not start checkout" });
  }
});

app.post("/webhooks/polar", async (req, reply) => {
  const raw = (req as unknown as { rawBody?: string }).rawBody ?? "";
  if (!verifyWebhook(raw, req.headers as Record<string, unknown>)) {
    return reply.code(401).send({ error: "bad signature" });
  }
  const evt = req.body as PolarEvent;
  const keyFromMeta = apiKeyFromEvent(evt);
  const email = evt.data.customer?.email;
  const subId = evt.data.subscription_id ?? (evt.type.startsWith("subscription.") ? evt.data.id : undefined);

  const target =
    (keyFromMeta ? getKey(keyFromMeta) : undefined) ??
    (subId ? findKeyBySubscription(subId) : undefined) ??
    (email ? findKeyByEmail(email) : undefined);

  if (!target) {
    req.log.warn({ type: evt.type }, "polar webhook: no matching api key");
    return reply.send({ ok: true, matched: false });
  }

  if (evt.type === "order.paid" || evt.type === "subscription.active") {
    setTier(target.key, "solo", { customerId: evt.data.customer?.id ?? evt.data.customer_id, subscriptionId: subId });
    req.log.info({ type: evt.type }, "upgraded key to solo");
    notify(`💰 <b>PAID — Solo</b>\n${escapeHtml(target.email)}\n$19/month`);
  } else if (evt.type === "subscription.canceled" || evt.type === "subscription.revoked") {
    setTier(target.key, "free");
    req.log.info({ type: evt.type }, "downgraded key to free");
    notify(`⬇️ <b>Subscription ended</b>\n${escapeHtml(target.email)}`);
  }
  return reply.send({ ok: true, matched: true });
});

app.get("/upgrade/done", async (_req, reply) =>
  reply.type("text/html; charset=utf-8").send(`<!doctype html><meta charset="utf-8">
<title>Subscribed — MintPDF</title>
<body style="background:#0a0e0c;color:#e9f1ed;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
<div><h1 style="color:#3ce0a5">You're on Solo.</h1>
<p style="color:#8ea69c;max-width:44ch;line-height:1.7">Your existing API key now has ${LIMITS.solo}
renders a month. Nothing else to set up: keep sending the same key.</p>
<p><a href="/" style="color:#3ce0a5">Back to MintPDF</a></p></div></body>`),
);

app.get("/guides", async (_req, reply) =>
  reply.type("text/html; charset=utf-8").send(renderIndex(BASE_URL)),
);

app.get<{ Params: { slug: string } }>("/guides/:slug", async (req, reply) => {
  const post = getPost(req.params.slug);
  if (!post) return reply.code(404).type("text/html").send("<h1>404</h1><p><a href='/guides'>All guides</a></p>");
  return reply.type("text/html; charset=utf-8").send(renderPost(post, BASE_URL));
});

app.get("/sitemap.xml", async (_req, reply) =>
  reply.type("application/xml").send(renderSitemap(BASE_URL)),
);

/** IndexNow: ping search engines directly when pages change. Key file lives in public/. */
app.post("/internal/indexnow", async (req, reply) => {
  const auth = String(req.headers.authorization ?? "");
  if (!process.env.INDEXNOW_KEY || auth !== `Bearer ${process.env.INDEXNOW_KEY}`) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  const host = new URL(BASE_URL).host;
  const urlList = ["", "/guides", ...getPosts().map((post) => `/guides/${post.slug}`)].map((u) => `${BASE_URL}${u}`);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, key: process.env.INDEXNOW_KEY, keyLocation: `${BASE_URL}/${process.env.INDEXNOW_KEY}.txt`, urlList }),
  });
  return reply.send({ submitted: urlList.length, status: res.status });
});

app.get("/robots.txt", async (_req, reply) =>
  reply.type("text/plain").send(`User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`),
);

app.get("/health", async () => ({ ok: true }));

const shutdown = async () => {
  await closeBrowser();
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: PORT, host: "0.0.0.0" });
