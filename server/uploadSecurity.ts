import fs from 'node:fs';
import path from 'node:path';

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

export type MediaCategory = 'image' | 'video' | 'audio' | 'pdf';

export interface VerifiedUploadResult {
  ok: true;
  category: MediaCategory;
  mimeType: string;
  extension: string;
  size: number;
  width?: number;
  height?: number;
}

export interface RejectedUploadResult {
  ok: false;
  error: string;
  code: string;
}

const MB = 1024 * 1024;
const MAX_IMAGE_DIM = 8000;
const MAX_IMAGE_PIXELS = 36_000_000;

interface ContextPolicy {
  allowed: MediaCategory[];
  maxBytes: Partial<Record<MediaCategory, number>>;
  labelAr: string;
}

const CONTEXT_POLICIES: Record<UploadContext, ContextPolicy> = {
  ai_image: {
    allowed: ['image'],
    maxBytes: { image: 8 * MB },
    labelAr: 'المساعد الذكي (صور فقط حتى 8MB)',
  },
  avatar: {
    allowed: ['image'],
    maxBytes: { image: 6 * MB },
    labelAr: 'الصورة الشخصية (صور فقط حتى 6MB)',
  },
  cover: {
    allowed: ['image'],
    maxBytes: { image: 6 * MB },
    labelAr: 'صورة الغلاف (صور فقط حتى 6MB)',
  },
  post_image: {
    allowed: ['image'],
    maxBytes: { image: 10 * MB },
    labelAr: 'صور المنشور (صور فقط حتى 10MB)',
  },
  pulse_poster: {
    allowed: ['image'],
    maxBytes: { image: 6 * MB },
    labelAr: 'صورة غلاف الفيديو (صور فقط حتى 6MB)',
  },
  story: {
    allowed: ['image', 'video'],
    maxBytes: { image: 10 * MB, video: 35 * MB },
    labelAr: 'القصة (صورة حتى 10MB أو فيديو حتى 35MB)',
  },
  pulse_video: {
    allowed: ['video'],
    maxBytes: { video: 60 * MB },
    labelAr: 'فيديو نبض (فيديو حتى 60MB)',
  },
  voice: {
    allowed: ['audio'],
    maxBytes: { audio: 15 * MB },
    labelAr: 'رسالة صوتية (صوت حتى 15MB)',
  },
  music: {
    allowed: ['audio'],
    maxBytes: { audio: 15 * MB },
    labelAr: 'مقطع موسيقي (صوت حتى 15MB)',
  },
  chat_media: {
    allowed: ['image', 'video', 'audio', 'pdf'],
    maxBytes: { image: 10 * MB, video: 40 * MB, audio: 15 * MB, pdf: 12 * MB },
    labelAr: 'مرفق دردشة (صورة/فيديو/صوت/PDF)',
  },
  general: {
    allowed: ['image', 'video', 'audio', 'pdf'],
    maxBytes: { image: 10 * MB, video: 40 * MB, audio: 15 * MB, pdf: 12 * MB },
    labelAr: 'ملف وسائط',
  },
};

function containsMaliciousSignature(headBuf: Buffer): string | null {
  if (headBuf.length >= 2 && headBuf[0] === 0x4d && headBuf[1] === 0x5a) {
    return 'تم رفض ملف تنفيذي (EXE/DLL) لحماية المنصة.';
  }
  if (headBuf.length >= 4 && headBuf[0] === 0x7f && headBuf[1] === 0x45 && headBuf[2] === 0x4c && headBuf[3] === 0x46) {
    return 'تم رفض ملف تنفيذي (ELF) لحماية المنصة.';
  }
  if (headBuf.length >= 2 && headBuf[0] === 0x23 && headBuf[1] === 0x21) {
    return 'تم رفض ملف سكربت تنفيذي لحماية المنصة.';
  }

  // Inspect leading text safely for SVG / HTML / JS / PHP polyglot XSS payloads
  const headText = headBuf.subarray(0, Math.min(headBuf.length, 2048)).toString('latin1').toLowerCase();
  if (
    headText.includes('<svg') ||
    headText.includes('<!doctype html') ||
    headText.includes('<html') ||
    headText.includes('<script') ||
    headText.includes('<?php') ||
    headText.includes('javascript:')
  ) {
    return 'تم رفض الملف لاحتوائه على كود HTML/SVG/Script غير مسموح به.';
  }
  return null;
}

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // IHDR chunk starts at byte 12 ("IHDR"), width at 16, height at 20 (big-endian uint32)
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function parseGifDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  return {
    width: buf.readUInt16LE(6),
    height: buf.readUInt16LE(8),
  };
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && buf.length >= 30) {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width: w, height: h };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    const w = buf.readUInt16LE(26) & 0x3fff;
    const h = buf.readUInt16LE(28) & 0x3fff;
    return { width: w, height: h };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    const w = (bits & 0x3fff) + 1;
    const h = ((bits >> 14) & 0x3fff) + 1;
    return { width: w, height: h };
  }
  return null;
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) break;
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 8 < buf.length) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segLen;
  }
  return null;
}

function sniffMagicType(
  buf: Buffer,
  declaredMime: string,
  context: UploadContext
): { category: MediaCategory; mimeType: string; extension: string; dims?: { width: number; height: number } | null } | null {
  if (buf.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { category: 'image', mimeType: 'image/png', extension: '.png', dims: parsePngDimensions(buf) };
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { category: 'image', mimeType: 'image/jpeg', extension: '.jpg', dims: parseJpegDimensions(buf) };
  }

  // GIF: GIF87a / GIF89a
  if (buf.length >= 6) {
    const sig6 = buf.toString('ascii', 0, 6);
    if (sig6 === 'GIF87a' || sig6 === 'GIF89a') {
      return { category: 'image', mimeType: 'image/gif', extension: '.gif', dims: parseGifDimensions(buf) };
    }
  }

  // RIFF container: WEBP (image) or WAVE (audio)
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF') {
    const form = buf.toString('ascii', 8, 12);
    if (form === 'WEBP') {
      return { category: 'image', mimeType: 'image/webp', extension: '.webp', dims: parseWebpDimensions(buf) };
    }
    if (form === 'WAVE') {
      return { category: 'audio', mimeType: 'audio/wav', extension: '.wav' };
    }
  }

  // PDF: %PDF-
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') {
    return { category: 'pdf', mimeType: 'application/pdf', extension: '.pdf' };
  }

  // OGG / Opus audio: OggS
  if (buf.toString('ascii', 0, 4) === 'OggS') {
    return { category: 'audio', mimeType: 'audio/ogg', extension: '.ogg' };
  }

  // MP3: ID3 tag or MPEG sync frame (only if not JPEG/other)
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return { category: 'audio', mimeType: 'audio/mpeg', extension: '.mp3' };
  }

  // ISO BMFF (MP4 / MOV / M4A): "ftyp" at offset 4
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12).trim();
    const isAudioBrand = brand === 'M4A' || brand === 'M4B' || declaredMime.startsWith('audio/') || context === 'voice' || context === 'music';
    if (isAudioBrand) {
      return { category: 'audio', mimeType: 'audio/mp4', extension: '.m4a' };
    }
    return { category: 'video', mimeType: 'video/mp4', extension: '.mp4' };
  }

  // EBML / WebM / Matroska: 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    const isAudioContext = context === 'voice' || context === 'music' || declaredMime.startsWith('audio/');
    if (isAudioContext) {
      return { category: 'audio', mimeType: 'audio/webm', extension: '.webm' };
    }
    return { category: 'video', mimeType: 'video/webm', extension: '.webm' };
  }

  return null;
}

export function normalizeUploadContext(raw?: string | null): UploadContext {
  const val = String(raw || '').trim() as UploadContext;
  return val in CONTEXT_POLICIES ? val : 'general';
}

/**
 * Verifies an uploaded file on disk using binary magic bytes, active XSS/executable scanning,
 * pixel-bomb dimension guards, and strict per-context type + size policies.
 */
export function verifyUploadedFile(
  filePath: string,
  declaredMime: string,
  rawContext?: string | null
): VerifiedUploadResult | RejectedUploadResult {
  const context = normalizeUploadContext(rawContext);
  const policy = CONTEXT_POLICIES[context];

  if (!fs.existsSync(filePath)) {
    return { ok: false, code: 'NOT_FOUND', error: 'تعذر قراءة الملف المرفوع.' };
  }

  const stat = fs.statSync(filePath);
  if (stat.size <= 0) {
    return { ok: false, code: 'EMPTY_FILE', error: 'الملف فارغ ولا يمكن رفعه.' };
  }

  // Read up to 64 KB for magic bytes + JPEG SOF marker scanning
  const readBytes = Math.min(stat.size, 65536);
  const head = Buffer.alloc(readBytes);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, head, 0, readBytes, 0);
  } finally {
    fs.closeSync(fd);
  }

  const threat = containsMaliciousSignature(head);
  if (threat) {
    return { ok: false, code: 'MALICIOUS_SIGNATURE', error: threat };
  }

  const sniffed = sniffMagicType(head, (declaredMime || '').toLowerCase(), context);
  if (!sniffed) {
    return {
      ok: false,
      code: 'UNSUPPORTED_BINARY',
      error: `صيغة الملف غير مدعومة أو تالفة. المسموح هنا: ${policy.labelAr}.`,
    };
  }

  if (!policy.allowed.includes(sniffed.category)) {
    return {
      ok: false,
      code: 'CATEGORY_NOT_ALLOWED',
      error: `هذا النوع من الملفات غير مسموح في هذا القسم. المسموح: ${policy.labelAr}.`,
    };
  }

  const maxLimit = policy.maxBytes[sniffed.category] || 10 * MB;
  if (stat.size > maxLimit) {
    const maxMb = Math.round(maxLimit / MB);
    const actualMb = (stat.size / MB).toFixed(1);
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      error: `حجم الملف (${actualMb}MB) يتجاوز الحد الأقصى المسموح (${maxMb}MB).`,
    };
  }

  if (sniffed.category === 'image') {
    const dims = sniffed.dims;
    if (dims) {
      if (
        dims.width <= 0 ||
        dims.height <= 0 ||
        dims.width > MAX_IMAGE_DIM ||
        dims.height > MAX_IMAGE_DIM ||
        dims.width * dims.height > MAX_IMAGE_PIXELS
      ) {
        return {
          ok: false,
          code: 'IMAGE_DIMENSION_BOMB',
          error: `أبعاد الصورة (${dims.width}×${dims.height}) كبيرة جدًا وغير آمنة؛ الحد الأقصى 8000×8000 بكسل.`,
        };
      }
    }
  }

  return {
    ok: true,
    category: sniffed.category,
    mimeType: sniffed.mimeType,
    extension: sniffed.extension,
    size: stat.size,
    width: sniffed.dims?.width,
    height: sniffed.dims?.height,
  };
}

/**
 * Safely renames a verified uploaded file to its canonical magic-byte extension
 * so disguised extensions can never be served.
 */
export function enforceCanonicalExtension(filePath: string, verifiedExt: string): string {
  const dir = path.dirname(filePath);
  const currentExt = path.extname(filePath).toLowerCase();
  if (currentExt === verifiedExt) return filePath;
  const base = path.basename(filePath, path.extname(filePath));
  const nextPath = path.join(dir, `${base}${verifiedExt}`);
  fs.renameSync(filePath, nextPath);
  return nextPath;
}
