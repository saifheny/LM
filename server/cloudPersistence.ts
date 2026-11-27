import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { DatabaseSync } from 'node:sqlite';
import { buildSupabaseAuthHeaders, ensureSupabaseBucket, getSupabaseConfig } from './cloudStorage.ts';

const SNAPSHOT_OBJECT_PATH = 'lm.db.gz';
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8');

let stateBucketEnsured = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<boolean> | null = null;
let dirtyFlag = false;
let lastSyncIso: string | null = null;
let lastSyncError: string | null = null;

export function getCloudDbSyncMeta() {
  const cfg = getSupabaseConfig();
  return {
    enabled: Boolean(cfg),
    provider: cfg ? 'supabase' : 'local',
    lastSyncAt: lastSyncIso,
    lastError: lastSyncError,
  };
}

/**
 * Restores the latest compressed SQLite database snapshot from private Supabase Storage
 * BEFORE `new DatabaseSync(dbPath)` opens the database on container cold-start / redeploy.
 * Safe no-op when Supabase env vars are unset or when a local db file already exists.
 */
export async function restoreDatabaseSnapshotIfConfigured(dbPath: string): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const forceRestore = process.env.FORCE_CLOUD_DB_RESTORE === '1';
  if (!forceRestore && fs.existsSync(dbPath) && fs.statSync(dbPath).size > 4096) {
    return false;
  }

  try {
    const url = `${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.stateBucket)}/${SNAPSHOT_OBJECT_PATH}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: buildSupabaseAuthHeaders(cfg.serviceRoleKey),
      signal: AbortSignal.timeout(12_000),
    });

    if (resp.status === 400 || resp.status === 404) {
      console.log('[LM CloudDB] No prior cloud snapshot found — initializing fresh database.');
      return false;
    }
    if (!resp.ok) {
      console.warn(`[LM CloudDB] Snapshot restore skipped (HTTP ${resp.status}).`);
      return false;
    }

    const gzBuf = Buffer.from(await resp.arrayBuffer());
    const rawDb = zlib.gunzipSync(gzBuf);
    if (rawDb.length < 4096 || !rawDb.subarray(0, 16).equals(SQLITE_HEADER)) {
      console.warn('[LM CloudDB] Downloaded snapshot failed SQLite header verification; ignoring.');
      return false;
    }

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${dbPath}.restore.tmp`;
    fs.writeFileSync(tmpPath, rawDb);
    fs.renameSync(tmpPath, dbPath);
    // Clean any stale WAL/SHM sidecars if present
    for (const suffix of ['-wal', '-shm']) {
      try {
        if (fs.existsSync(`${dbPath}${suffix}`)) fs.unlinkSync(`${dbPath}${suffix}`);
      } catch {
        // ignore
      }
    }
    console.log(`[LM CloudDB] Restored database snapshot from Supabase (${Math.round(rawDb.length / 1024)} KB).`);
    return true;
  } catch (err) {
    console.warn('[LM CloudDB] Snapshot restore failed, falling back to local DB:', (err as Error).message);
    return false;
  }
}

/**
 * Takes an atomic, corruption-free SQLite snapshot via `VACUUM INTO`, gzips it,
 * and uploads it to the PRIVATE Supabase Storage bucket (`lm-state/lm.db.gz`).
 */
export async function syncDatabaseSnapshotNow(db: DatabaseSync, dbPath: string): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  if (syncInFlight) {
    dirtyFlag = true;
    return syncInFlight;
  }

  const run = async (): Promise<boolean> => {
    dirtyFlag = false;
    const snapPath = path.join(path.dirname(dbPath), `lm.snap.${Date.now()}.db`);
    try {
      if (!stateBucketEnsured) {
        stateBucketEnsured = await ensureSupabaseBucket(cfg, cfg.stateBucket, false);
      }

      if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
      // Escape single quotes safely for SQLite VACUUM INTO literal
      const escapedSnap = snapPath.replace(/'/g, "''");
      db.exec(`VACUUM INTO '${escapedSnap}';`);

      const rawBytes = fs.readFileSync(snapPath);
      const gzBytes = zlib.gzipSync(rawBytes, { level: 6 });
      const uploadUrl = `${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.stateBucket)}/${SNAPSHOT_OBJECT_PATH}`;

      const resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: buildSupabaseAuthHeaders(cfg.serviceRoleKey, {
          'Content-Type': 'application/gzip',
          'x-upsert': 'true',
        }),
        body: gzBytes,
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        lastSyncError = `HTTP ${resp.status}: ${errText.slice(0, 120)}`;
        console.warn('[LM CloudDB] Snapshot upload failed:', lastSyncError);
        return false;
      }

      lastSyncIso = new Date().toISOString();
      lastSyncError = null;
      return true;
    } catch (err) {
      lastSyncError = (err as Error).message;
      console.warn('[LM CloudDB] Snapshot sync error:', lastSyncError);
      return false;
    } finally {
      try {
        if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
      } catch {
        // ignore cleanup error
      }
      syncInFlight = null;
      if (dirtyFlag) {
        scheduleCloudDbSync(db, dbPath, 10_000);
      }
    }
  };

  syncInFlight = run();
  return syncInFlight;
}

export function scheduleCloudDbSync(db: DatabaseSync, dbPath: string, delayMs = 12_000): void {
  if (!getSupabaseConfig()) return;
  dirtyFlag = true;
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncDatabaseSnapshotNow(db, dbPath);
  }, delayMs);
  syncTimer.unref?.();
}

export async function flushCloudDbBeforeExit(db: DatabaseSync, dbPath: string): Promise<void> {
  if (!getSupabaseConfig()) return;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (dirtyFlag || syncInFlight) {
    await syncDatabaseSnapshotNow(db, dbPath);
  }
}
