import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, '../uploads/seed');

const RETRY: Array<{ filename: string; urls: string[] }> = [
  {
    filename: 'avatar_youssef.jpg',
    urls: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'],
  },
  {
    filename: 'avatar_mariam.jpg',
    urls: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'],
  },
  {
    filename: 'reel1.mp4',
    urls: [
      'https://assets.mixkit.co/videos/41574/41574-720.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    ],
  },
  {
    filename: 'reel2.mp4',
    urls: [
      'https://assets.mixkit.co/videos/34563/34563-720.mp4',
      'https://assets.mixkit.co/videos/1191/1191-720.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    ],
  },
  {
    filename: 'reel3.mp4',
    urls: [
      'https://assets.mixkit.co/videos/39879/39879-720.mp4',
      'https://assets.mixkit.co/videos/44559/44559-720.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    ],
  },
  {
    filename: 'reel4.mp4',
    urls: [
      'https://assets.mixkit.co/videos/34487/34487-720.mp4',
      'https://assets.mixkit.co/videos/42646/42646-720.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    ],
  },
];

async function run() {
  for (const item of RETRY) {
    const dest = path.join(SEED_DIR, item.filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
      console.log('Already exists:', item.filename);
      continue;
    }
    for (const u of item.urls) {
      try {
        const res = await fetch(u, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          console.log(`Skip ${u} -> HTTP ${res.status}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 5000) {
          fs.writeFileSync(dest, buf);
          console.log(`SUCCESS ${item.filename} from ${u} (${Math.round(buf.byteLength / 1024)} KB)`);
          break;
        }
      } catch (e) {
        console.log(`Error ${u}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }
}

run();
