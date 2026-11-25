export async function api<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
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

export async function uploadFile(file: File): Promise<{ url: string; originalName: string; mimeType: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Upload failed');
  return data;
}

export const apiUploadFile = uploadFile;
