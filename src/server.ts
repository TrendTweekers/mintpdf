import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { htmlToPdf, markdownToPdf, urlToPdf, closeBrowser, PdfOptions } from "./pdf.js";
import { LIMITS, consumeQuota, createKey, keyExists, readPdf, storePdf } from "./store.js";
import { handleMcpRequest } from "./mcp.js";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

const app = Fastify({
  logger: true,
  bodyLimit: 5 * 1024 * 1024,
  trustProxy: true,
});

await app.register(fastifyStatic, {
  root: join(dirname(fileURLToPath(import.meta.url)), "..", "public"),
});

interface PdfBody extends PdfOptions {
  html?: string;
  markdown?: string;
  url?: string;
  output?: "pdf" | "url";
}

function rateLimit(req: { headers: Record<string, unknown>; ip: string }): { ok: boolean; remaining: number; keyed: boolean } {
  const auth = String(req.headers.authorization ?? "");
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (key && keyExists(key)) {
    const remaining = consumeQuota(`key:${key}`, LIMITS.keyedPerDay);
    return { ok: remaining >= 0, remaining, keyed: true };
  }
  const remaining = consumeQuota(`ip:${req.ip}`, LIMITS.anonymousPerDay);
  return { ok: remaining >= 0, remaining, keyed: false };
}

app.post<{ Body: PdfBody }>("/v1/pdf", async (req, reply) => {
  const quota = rateLimit(req);
  reply.header("x-ratelimit-remaining", String(Math.max(quota.remaining, 0)));
  if (!quota.ok) {
    return reply.code(429).send({
      error: "daily limit reached",
      hint: quota.keyed
        ? "Keyed limit reached; contact us to raise it while PDFMint is in beta."
        : `Anonymous trial is ${LIMITS.anonymousPerDay}/day. POST /v1/keys {\"email\":\"you@example.com\"} for a free key (${LIMITS.keyedPerDay}/day).`,
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
  return reply.send({ key, daily_limit: LIMITS.keyedPerDay });
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

app.get("/health", async () => ({ ok: true }));

const shutdown = async () => {
  await closeBrowser();
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: PORT, host: "0.0.0.0" });
