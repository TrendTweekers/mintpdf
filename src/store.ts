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

export type Tier = "free" | "solo";

export const LIMITS = {
  /** Anonymous is a rate limit (per IP, per day), keyed tiers are monthly quotas. */
  anonymousPerDay: Number(process.env.ANON_DAILY_LIMIT ?? 3),
  free: Number(process.env.FREE_MONTHLY_LIMIT ?? 100),
  solo: Number(process.env.SOLO_MONTHLY_LIMIT ?? 2000),
};

export function dailyLimitFor(tier: Tier): number {
  return tier === "solo" ? LIMITS.solo : LIMITS.free;
}

/**
 * Issues a key for an email. If that email already has a paid subscription, the
 * subscription moves to the new key and the old one drops to free, so losing a key
 * never orphans a subscription: ask for another with the same address.
 */
export function createKey(email: string): { key: string; tier: Tier; recovered: boolean } {
  const key = "pm_" + randomBytes(24).toString("base64url");
  const previous = findKeyByEmail(email);
  const carriesSubscription = previous?.tier === "solo";

  db.prepare("INSERT INTO api_keys (key, email, created_at, tier) VALUES (?, ?, ?, ?)").run(
    key,
    email,
    Date.now(),
    carriesSubscription ? "solo" : "free",
  );

  if (carriesSubscription && previous) {
    const row = db
      .prepare("SELECT polar_customer_id, polar_subscription_id FROM api_keys WHERE key = ?")
      .get(previous.key) as { polar_customer_id?: string; polar_subscription_id?: string } | undefined;
    db.prepare(
      "UPDATE api_keys SET polar_customer_id = ?, polar_subscription_id = ? WHERE key = ?",
    ).run(row?.polar_customer_id ?? null, row?.polar_subscription_id ?? null, key);
    // The old key must stop billing-by-proxy, and must no longer answer webhook lookups.
    db.prepare(
      "UPDATE api_keys SET tier = 'free', polar_subscription_id = NULL WHERE key = ?",
    ).run(previous.key);
  }

  return { key, tier: carriesSubscription ? "solo" : "free", recovered: carriesSubscription };
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
