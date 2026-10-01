import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

type DB = ReturnType<typeof createDb>;

/**
 * `next build` boots many workers that all import lib/db and race migrate():
 * each checks the journal before any commits, so with a PENDING migration two
 * workers can both attempt the same DDL ("table X already exists"). Retry with
 * a short backoff — by then the winning worker has recorded the migration and
 * migrate() becomes the usual no-op. Rethrow if it still fails (real breakage).
 */
function runMigrations(
  db: ReturnType<typeof drizzle<typeof schema>>,
  sqlite: InstanceType<typeof Database>,
) {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  sqlite.pragma("busy_timeout = 5000");
  for (let attempt = 0; ; attempt++) {
    try {
      migrate(db, { migrationsFolder });
      return;
    } catch (error) {
      if (attempt >= 4) throw error;
      // Synchronous backoff — createDb() runs at first import, no async allowed.
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        250 * (attempt + 1),
      );
    }
  }
}

function createDb() {
  const dataDir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(path.join(dataDir, "studio.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  runMigrations(db, sqlite);

  // Boot-time reconciler: any meeting left mid-pipeline (process died /
  // server restarted) can never resume — flip it to failed so the UI shows a
  // retry affordance instead of polling forever.
  try {
    db.update(schema.meetings)
      .set({
        status: "failed",
        errorMessage: "پردازش به دلیل راه‌اندازی مجدد سرور قطع شد.",
        updatedAt: new Date(),
      })
      .where(inArray(schema.meetings.status, ["transcribing", "summarizing"]))
      .run();
  } catch {
    // Defensive: should never fire post-migrate, but never block boot on it.
  }

  return db;
}

// Survive dev HMR: keep a single connection on globalThis
const globalForDb = globalThis as unknown as { __studioDb?: DB };

export const db: DB = (globalForDb.__studioDb ??= createDb());
