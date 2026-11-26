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
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
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
