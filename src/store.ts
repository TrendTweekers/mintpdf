import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "/tmp/pdfmint";
const FILES_DIR = join(DATA_DIR, "files");
mkdirSync(FILES_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, "pdfmint.db"));
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

export const LIMITS = {
  anonymousPerDay: Number(process.env.ANON_DAILY_LIMIT ?? 5),
  keyedPerDay: Number(process.env.KEY_DAILY_LIMIT ?? 100),
};

export function createKey(email: string): string {
  const key = "pm_" + randomBytes(24).toString("base64url");
  db.prepare("INSERT INTO api_keys (key, email, created_at) VALUES (?, ?, ?)").run(key, email, Date.now());
  return key;
}

export function keyExists(key: string): boolean {
  return db.prepare("SELECT 1 FROM api_keys WHERE key = ?").get(key) !== undefined;
}

/** Returns remaining quota for today after consuming one unit, or -1 if exhausted. */
export function consumeQuota(bucket: string, limit: number): number {
  const day = new Date().toISOString().slice(0, 10);
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
      // file already gone; ignore
    }
  }
}

setInterval(cleanupExpiredFiles, 10 * 60 * 1000).unref();
