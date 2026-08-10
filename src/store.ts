import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "/tmp/mintpdf";
const FILES_DIR = join(DATA_DIR, "files");
mkdirSync(FILES_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, "mintpdf.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS usage (
    bucket TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, day)
  );
  /* Own analytics. Telegram pings cannot be aggregated or filtered after the fact, so the same
     signal is kept here as rows. No third-party script, no cookie, no personal data: the visitor
     is a daily salted hash of the IP, which is enough to count uniques and nothing else. */
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    path TEXT,
    ref TEXT,
    country TEXT,
    visitor TEXT,
    bot INTEGER NOT NULL DEFAULT 0,
    detail TEXT
  );
  CREATE INDEX IF NOT EXISTS events_day ON events (day, kind);
`);

/** Additive migrations; safe to run on an existing database. */
for (const col of [
  "tier TEXT NOT NULL DEFAULT 'free'",
  "polar_customer_id TEXT",
  "polar_subscription_id TEXT",
]) {
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN ${col}`);
  } catch {
    // column already present
  }
}

export type Tier = "free" | "solo" | "team" | "scale";

/**
 * Paid tiers exist so that growth has somewhere to go. With a single $19 plan the most any
 * customer could ever pay was $19, however much they rendered, which capped revenue by design
 * rather than by demand.
 *
 * Prices live in Polar, not here. This is only the quota each tier grants.
 */
export const LIMITS = {
  /** Anonymous is a rate limit (per IP, per day); keyed tiers are monthly quotas. */
  anonymousPerDay: Number(process.env.ANON_DAILY_LIMIT ?? 10),
  free: Number(process.env.FREE_MONTHLY_LIMIT ?? 100),
  solo: Number(process.env.SOLO_MONTHLY_LIMIT ?? 3000),
  team: Number(process.env.TEAM_MONTHLY_LIMIT ?? 12000),
  scale: Number(process.env.SCALE_MONTHLY_LIMIT ?? 50000),
};

export const PAID_TIERS = ["solo", "team", "scale"] as const;

export function isTier(v: string): v is Tier {
  return v === "free" || v === "solo" || v === "team" || v === "scale";
}

export function dailyLimitFor(tier: Tier): number {
  return LIMITS[tier] ?? LIMITS.free;
}

/**
 * Issues a key for an email address.
 *
 * Deliberately does NOT move a paid subscription to the new key. Email addresses are
 * not verified here, so an automatic transfer would let anyone who knows a customer's
 * address take over their subscription and demote their key. Paid recovery is handled
 * out of band until verified email recovery exists.
 */
export function createKey(email: string): { key: string; tier: Tier; paidKeyExists: boolean } {
  const key = "pm_" + randomBytes(24).toString("base64url");
  const previous = findKeyByEmail(email);
  db.prepare("INSERT INTO api_keys (key, email, created_at, tier) VALUES (?, ?, ?, 'free')").run(
    key,
    email,
    Date.now(),
  );
  const wasPaid = previous ? previous.tier !== "free" : false;
  return { key, tier: "free", paidKeyExists: wasPaid };
}

export interface KeyRecord {
  key: string;
  email: string;
  tier: Tier;
}

export function getKey(key: string): KeyRecord | undefined {
  const row = db.prepare("SELECT key, email, tier FROM api_keys WHERE key = ?").get(key) as
    | { key: string; email: string; tier: string }
    | undefined;
  return row ? { key: row.key, email: row.email, tier: (row.tier as Tier) ?? "free" } : undefined;
}

export function findKeyByEmail(email: string): KeyRecord | undefined {
  const row = db
    .prepare("SELECT key, email, tier FROM api_keys WHERE email = ? ORDER BY created_at DESC LIMIT 1")
    .get(email.trim().toLowerCase()) as { key: string; email: string; tier: string } | undefined;
  return row ? { key: row.key, email: row.email, tier: (row.tier as Tier) ?? "free" } : undefined;
}

export function findKeyBySubscription(subscriptionId: string): KeyRecord | undefined {
  const row = db
    .prepare("SELECT key, email, tier FROM api_keys WHERE polar_subscription_id = ?")
    .get(subscriptionId) as { key: string; email: string; tier: string } | undefined;
  return row ? { key: row.key, email: row.email, tier: (row.tier as Tier) ?? "free" } : undefined;
}

export function setTier(
  key: string,
  tier: Tier,
  polar?: { customerId?: string; subscriptionId?: string },
): void {
  db.prepare(
    "UPDATE api_keys SET tier = ?, polar_customer_id = COALESCE(?, polar_customer_id), polar_subscription_id = COALESCE(?, polar_subscription_id) WHERE key = ?",
  ).run(tier, polar?.customerId ?? null, polar?.subscriptionId ?? null, key);
}

/** Consumes one unit from a bucket's window. Returns remaining, or -1 if exhausted. */
export function consumeQuota(bucket: string, limit: number, period: "day" | "month" = "day"): number {
  const day = new Date().toISOString().slice(0, period === "month" ? 7 : 10);
  const row = db.prepare("SELECT count FROM usage WHERE bucket = ? AND day = ?").get(bucket, day) as
    | { count: number }
    | undefined;
  const used = row?.count ?? 0;
  if (used >= limit) return -1;
  db.prepare(
    "INSERT INTO usage (bucket, day, count) VALUES (?, ?, 1) ON CONFLICT(bucket, day) DO UPDATE SET count = count + 1",
  ).run(bucket, day);
  return limit - used - 1;
}

/** True the first time it is called with this key today; false afterwards. */
export function onceToday(key: string): boolean {
  return consumeQuota(`once:${key}`, 1) >= 0;
}

const FILE_TTL_MS = 60 * 60 * 1000;

export function storePdf(pdf: Buffer): { id: string; expiresAt: string } {
  const id = randomUUID();
  writeFileSync(join(FILES_DIR, `${id}.pdf`), pdf);
  return { id, expiresAt: new Date(Date.now() + FILE_TTL_MS).toISOString() };
}

export function readPdf(id: string): Buffer | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  try {
    return readFileSync(join(FILES_DIR, `${id}.pdf`));
  } catch {
    return null;
  }
}

export function cleanupExpiredFiles(): void {
  const cutoff = Date.now() - FILE_TTL_MS;
  for (const f of readdirSync(FILES_DIR)) {
    const p = join(FILES_DIR, f);
    try {
      if (statSync(p).mtimeMs < cutoff) unlinkSync(p);
    } catch {
      // already gone
    }
  }
}

setInterval(cleanupExpiredFiles, 10 * 60 * 1000).unref();

/* ---------------------------------------------------------------- own analytics */

export interface EventInput {
  kind: "visit" | "render" | "key" | "limit";
  path?: string;
  ref?: string;
  country?: string;
  visitor?: string;
  bot?: boolean;
  detail?: string;
}

export function recordEvent(e: EventInput): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO events (at, day, kind, path, ref, country, visitor, bot, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    now,
    new Date(now).toISOString().slice(0, 10),
    e.kind,
    e.path?.slice(0, 160) ?? null,
    e.ref?.slice(0, 200) ?? null,
    e.country?.slice(0, 60) ?? null,
    e.visitor?.slice(0, 64) ?? null,
    e.bot ? 1 : 0,
    e.detail?.slice(0, 200) ?? null,
  );
}

export interface StatsRow {
  [key: string]: string | number;
}

/** Everything the stats page needs, in one place so the route stays dumb. */
export function readStats(days = 30): Record<string, StatsRow[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const q = (sql: string) => db.prepare(sql).all(since) as unknown as StatsRow[];
  return {
    daily: q(
      `SELECT day,
              SUM(kind='visit' AND bot=0) AS humans,
              SUM(kind='visit' AND bot=1) AS bots,
              COUNT(DISTINCT CASE WHEN kind='visit' AND bot=0 THEN visitor END) AS uniques,
              SUM(kind='render') AS renders,
              SUM(kind='key') AS keys,
              SUM(kind='limit') AS turned_away
       FROM events WHERE day >= ? GROUP BY day ORDER BY day DESC`,
    ),
    paths: q(
      `SELECT path, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS uniques
       FROM events WHERE day >= ? AND kind='visit' AND bot=0
       GROUP BY path ORDER BY hits DESC LIMIT 25`,
    ),
    refs: q(
      `SELECT COALESCE(NULLIF(ref,''),'(direct)') AS ref, COUNT(*) AS hits
       FROM events WHERE day >= ? AND kind='visit' AND bot=0
       GROUP BY ref ORDER BY hits DESC LIMIT 25`,
    ),
    countries: q(
      `SELECT COALESCE(NULLIF(country,''),'(unknown)') AS country, COUNT(*) AS hits
       FROM events WHERE day >= ? AND kind='visit' AND bot=0
       GROUP BY country ORDER BY hits DESC LIMIT 20`,
    ),
    renders: q(
      `SELECT COALESCE(detail,'(unknown)') AS source, COUNT(*) AS n
       FROM events WHERE day >= ? AND kind='render' GROUP BY detail ORDER BY n DESC`,
    ),
    turnedAway: q(
      `SELECT COALESCE(detail,'?') AS who,
              COALESCE(NULLIF(ref,''),'(direct)') AS came_from,
              COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people
       FROM events WHERE day >= ? AND kind='limit'
       GROUP BY detail, ref ORDER BY hits DESC LIMIT 15`,
    ),
    botsSeen: q(
      `SELECT COALESCE(NULLIF(country,''),'(unknown)') AS country, COUNT(*) AS hits
       FROM events WHERE day >= ? AND kind='visit' AND bot=1
       GROUP BY country ORDER BY hits DESC LIMIT 10`,
    ),
  };
}
