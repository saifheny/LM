export type UploadContext =
  | 'ai_image'
  | 'avatar'
  | 'cover'
  | 'post_image'
  | 'story'
  | 'pulse_video'
  | 'pulse_poster'
  | 'voice'
  | 'music'
  | 'chat_media'
  | 'general';

const MB = 1024 * 1024;

const CLIENT_LIMITS: Record<UploadContext, { maxBytes: number; imageOnly?: boolean; videoOnly?: boolean; audioOnly?: boolean; labelAr: string }> = {
  ai_image: { maxBytes: 8 * MB, imageOnly: true, labelAr: 'صورة واحدة فقط (JPG/PNG/WebP/GIF) بحد أقصى 8MB' },
  avatar: { maxBytes: 6 * MB, imageOnly: true, labelAr: 'صورة شخصية (JPG/PNG/WebP) بحد أقصى 6MB' },
  cover: { maxBytes: 6 * MB, imageOnly: true, labelAr: 'صورة غلاف (JPG/PNG/WebP) بحد أقصى 6MB' },
  post_image: { maxBytes: 10 * MB, imageOnly: true, labelAr: 'صورة منشور (JPG/PNG/WebP/GIF) بحد أقصى 10MB' },
  pulse_poster: { maxBytes: 6 * MB, imageOnly: true, labelAr: 'صورة غلاف (JPG/PNG/WebP) بحد أقصى 6MB' },
  story: { maxBytes: 35 * MB, labelAr: 'صورة (10MB) أو فيديو قصير (35MB)' },
  pulse_video: { maxBytes: 60 * MB, videoOnly: true, labelAr: 'فيديو (MP4/WebM) بحد أقصى 60MB' },
  voice: { maxBytes: 15 * MB, audioOnly: true, labelAr: 'رسالة صوتية بحد أقصى 15MB' },
  music: { maxBytes: 15 * MB, audioOnly: true, labelAr: 'ملف صوتي (MP3/WAV/M4A/OGG) بحد أقصى 15MB' },
  chat_media: { maxBytes: 40 * MB, labelAr: 'صورة أو فيديو أو صوت أو PDF' },
  general: { maxBytes: 40 * MB, labelAr: 'ملف وسائط آمن' },
};

const BLOCKED_EXTS = /\.(svg|html?|xhtml|js|mjs|cjs|exe|dll|bat|cmd|ps1|sh|php|jsp|asp|msi|apk|scr|vbs)$/i;

const TOKEN_STORAGE_KEY = 'lm_auth_token';
const DEVICE_STORAGE_KEY = 'lm_device_id';

export function getOrCreateDeviceId(): string {
  try {
    let existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!existing) {
      const m = document.cookie.match(/(?:^|;\s*)lm_device_pub=([^;]+)/);
      if (m) existing = decodeURIComponent(m[1]);
    }
    if (existing && /^[A-Za-z0-9_-]{10,64}$/.test(existing)) {
      localStorage.setItem(DEVICE_STORAGE_KEY, existing);
      return existing;
    }
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const created = `dev_${hex}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, created);
    document.cookie = `lm_device_pub=${encodeURIComponent(created)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    return created;
  } catch {
    return 'dev_fallback_client';
  }
}

function getDeviceProfileHeader(): string {
  try {
    const ua = navigator.userAgent || '';
    const platform = /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Macintosh|Mac OS/i.test(ua)
            ? 'macOS'
            : /Linux/i.test(ua)
              ? 'Linux'
              : 'Web';
    const browser = /Edg\//i.test(ua)
      ? 'Edge'
      : /OPR\//i.test(ua)
        ? 'Opera'
        : /Chrome\//i.test(ua)
          ? 'Chrome'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : /Firefox\//i.test(ua)
              ? 'Firefox'
              : 'Browser';
    const dpr = Math.round((window.devicePixelRatio || 1) * 10) / 10;
    const screen = `${window.screen?.width || 0}x${window.screen?.height || 0}@${dpr}x`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return JSON.stringify({ platform, browser, screen, tz });
  } catch {
    return '{}';
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken();
  const deviceId = getOrCreateDeviceId();
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-LM-Device-Id': deviceId,
      'X-LM-Device-Profile': getDeviceProfileHeader(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function apiGet<T = Record<string, unknown>>(path: string): Promise<T> {
  return api<T>(path, { method: 'GET' });
}

export async function apiPost<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function uploadFile(
  file: File,
  context: UploadContext = 'general'
): Promise<{ url: string; originalName: string; mimeType: string; category?: string; size?: number; width?: number; height?: number }> {
  const policy = CLIENT_LIMITS[context] || CLIENT_LIMITS.general;

  if (file.size <= 0) {
    throw new Error('الملف فارغ ولا يمكن رفعه.');
  }
  if (BLOCKED_EXTS.test(file.name) || file.type === 'image/svg+xml') {
    throw new Error('صيغة هذا الملف غير مسموحة لأسباب أمنية.');
  }
  if (policy.imageOnly && !/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
    throw new Error(`المسموح هنا: ${policy.labelAr}.`);
  }
  if (policy.videoOnly && !/^video\//i.test(file.type)) {
    throw new Error(`المسموح هنا: ${policy.labelAr}.`);
  }
  if (policy.audioOnly && !/^audio\//i.test(file.type) && !/^video\/webm$/i.test(file.type)) {
    throw new Error(`المسموح هنا: ${policy.labelAr}.`);
  }
  if (file.size > policy.maxBytes) {
    const maxMb = Math.round(policy.maxBytes / MB);
    throw new Error(`حجم الملف يتجاوز الحد المسموح (${maxMb}MB).`);
  }

  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/upload?context=${encodeURIComponent(context)}`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'فشل رفع الملف');
  return data;
}

export const apiUploadFile = uploadFile;
