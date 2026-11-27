import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  mediaBucket: string;
  stateBucket: string;
}

export interface CloudMediaUploadResult {
  url: string;
  storage: 'cloudinary' | 'supabase' | 'local';
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const folder = (process.env.CLOUDINARY_FOLDER || 'lm').trim().replace(/^\/+|\/+$/g, '') || 'lm';
  const rawUrl = (process.env.CLOUDINARY_URL || '').trim();
  if (rawUrl) {
    // Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
    const m = rawUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@([A-Za-z0-9_-]+)$/i);
    if (m) {
      return {
        apiKey: decodeURIComponent(m[1]),
        apiSecret: decodeURIComponent(m[2]),
        cloudName: m[3],
        folder,
      };
    }
  }
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret, folder };
  }
  return null;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const rawUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();
  if (!rawUrl || !key || !/^https?:\/\//i.test(rawUrl)) return null;
  const mediaBucket = (process.env.SUPABASE_MEDIA_BUCKET || 'lm-media').trim() || 'lm-media';
  const stateBucket = (process.env.SUPABASE_STATE_BUCKET || 'lm-state').trim() || 'lm-state';
  return { url: rawUrl, serviceRoleKey: key, mediaBucket, stateBucket };
}

export function getCloudStorageStatus(): {
  mediaProvider: 'cloudinary' | 'supabase' | 'local';
  mediaFailover: 'supabase' | null;
  dbPersistence: 'supabase' | 'local';
} {
  const hasCloudinary = Boolean(getCloudinaryConfig());
  const hasSupabase = Boolean(getSupabaseConfig());
  return {
    mediaProvider: hasCloudinary ? 'cloudinary' : hasSupabase ? 'supabase' : 'local',
    mediaFailover: hasCloudinary && hasSupabase ? 'supabase' : null,
    dbPersistence: hasSupabase ? 'supabase' : 'local',
  };
}

let supabaseMediaBucketEnsured = false;

export async function ensureSupabaseBucket(
  cfg: SupabaseConfig,
  bucketName: string,
  isPublic: boolean
): Promise<boolean> {
  try {
    const resp = await fetch(`${cfg.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        apikey: cfg.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: bucketName,
        name: bucketName,
        public: isPublic,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200/201 = created, 400/409 = already exists
    return resp.ok || resp.status === 400 || resp.status === 409;
  } catch {
    return false;
  }
}

async function uploadToCloudinary(
  cfg: CloudinaryConfig,
  filePath: string,
  safeFilename: string,
  mimeType: string
): Promise<string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sigBase = `folder=${cfg.folder}&timestamp=${timestamp}${cfg.apiSecret}`;
  const signature = crypto.createHash('sha1').update(sigBase).digest('hex');

  const fileBytes = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([fileBytes], { type: mimeType || 'application/octet-stream' }), safeFilename);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', timestamp);
  form.append('folder', cfg.folder);
  form.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/auto/upload`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Cloudinary upload HTTP ${resp.status}: ${errText.slice(0, 180)}`);
  }
  const data = (await resp.json()) as { secure_url?: string; url?: string };
  const secureUrl = data.secure_url || data.url;
  if (!secureUrl) throw new Error('Cloudinary response missing secure_url');
  return secureUrl;
}

async function uploadToSupabaseMedia(
  cfg: SupabaseConfig,
  filePath: string,
  safeFilename: string,
  mimeType: string
): Promise<string> {
  if (!supabaseMediaBucketEnsured) {
    supabaseMediaBucketEnsured = await ensureSupabaseBucket(cfg, cfg.mediaBucket, true);
  }
  const fileBytes = fs.readFileSync(filePath);
  const objectPath = `uploads/${safeFilename}`;
  const uploadUrl = `${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.mediaBucket)}/${objectPath}`;
  const resp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      apikey: cfg.serviceRoleKey,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: fileBytes,
    signal: AbortSignal.timeout(45_000),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Supabase Storage upload HTTP ${resp.status}: ${errText.slice(0, 180)}`);
  }
  return `${cfg.url}/storage/v1/object/public/${encodeURIComponent(cfg.mediaBucket)}/${objectPath}`;
}

/**
 * Uploads an already-verified file to the active free cloud media CDN (Cloudinary -> Supabase -> Local).
 * Removes the local temp file once safely stored in cloud CDN so free 256MB-512MB containers stay clean!
 */
export async function storeVerifiedMedia(params: {
  filePath: string;
  safeFilename: string;
  mimeType: string;
}): Promise<CloudMediaUploadResult> {
  const cloudinary = getCloudinaryConfig();
  const supabase = getSupabaseConfig();

  if (cloudinary) {
    try {
      const url = await uploadToCloudinary(cloudinary, params.filePath, params.safeFilename, params.mimeType);
      try {
        if (fs.existsSync(params.filePath)) fs.unlinkSync(params.filePath);
      } catch {
        // ignore cleanup error
      }
      return { url, storage: 'cloudinary' };
    } catch (err) {
      console.warn('[LM CloudStorage] Cloudinary upload failed, trying fallback:', (err as Error).message);
    }
  }

  if (supabase) {
    try {
      const url = await uploadToSupabaseMedia(supabase, params.filePath, params.safeFilename, params.mimeType);
      try {
        if (fs.existsSync(params.filePath)) fs.unlinkSync(params.filePath);
      } catch {
        // ignore cleanup error
      }
      return { url, storage: 'supabase' };
    } catch (err) {
      console.warn('[LM CloudStorage] Supabase Storage upload failed, keeping local file:', (err as Error).message);
    }
  }

  return {
    url: `/uploads/${params.safeFilename}`,
    storage: 'local',
  };
}

/**
 * Strictly validates that a media URL is either local `/uploads/...` or belongs to OUR configured
 * Cloudinary / Supabase CDN domain (prevents SSRF when fetching voice notes or AI attachments).
 */
export function isTrustedMediaUrl(mediaUrl: string | null | undefined): mediaUrl is string {
  if (!mediaUrl || typeof mediaUrl !== 'string') return false;
  if (mediaUrl.startsWith('/uploads/')) return true;
  if (!mediaUrl.startsWith('https://')) return false;
  try {
    const parsed = new URL(mediaUrl);
    const cloudinary = getCloudinaryConfig();
    if (
      cloudinary &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${cloudinary.cloudName}/`)
    ) {
      return true;
    }
    const supabase = getSupabaseConfig();
    if (supabase) {
      const sbHost = new URL(supabase.url).hostname;
      if (parsed.hostname === sbHost && parsed.pathname.includes('/storage/v1/object/public/')) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Loads media bytes cleanly from either local `/uploads/` or our trusted Cloudinary/Supabase CDN.
 */
export async function loadTrustedMediaBytes(
  mediaUrl: string,
  uploadsDir: string,
  maxBytes = 15 * 1024 * 1024
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  if (!isTrustedMediaUrl(mediaUrl)) return null;

  if (mediaUrl.startsWith('/uploads/')) {
    const rel = mediaUrl.replace(/^\/uploads\//, '').replace(/\.\./g, '');
    const resolved = path.resolve(uploadsDir, rel);
    if (!resolved.startsWith(path.resolve(uploadsDir)) || !fs.existsSync(resolved)) return null;
    const stat = fs.statSync(resolved);
    if (stat.size <= 0 || stat.size > maxBytes) return null;
    const ext = path.extname(resolved).toLowerCase();
    const mimeByExt: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.oga': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.mp4': 'audio/mp4',
      '.webm': 'audio/webm',
    };
    return {
      buffer: fs.readFileSync(resolved),
      mimeType: mimeByExt[ext] || 'application/octet-stream',
      filename: path.basename(resolved),
    };
  }

  try {
    const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) return null;
    const contentLen = Number(resp.headers.get('content-length') || 0);
    if (contentLen > maxBytes) return null;
    const arr = await resp.arrayBuffer();
    if (arr.byteLength <= 0 || arr.byteLength > maxBytes) return null;
    const mimeType = (resp.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
    const pathname = new URL(mediaUrl).pathname;
    return {
      buffer: Buffer.from(arr),
      mimeType,
      filename: path.basename(pathname) || 'media',
    };
  } catch {
    return null;
  }
}
