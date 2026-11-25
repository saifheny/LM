import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, '../uploads/seed');
if (!fs.existsSync(SEED_DIR)) fs.mkdirSync(SEED_DIR, { recursive: true });

const ASSETS: Array<{ filename: string; url: string }> = [
  // Real fast-loading HD MP4 videos
  { filename: 'reel1.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
  { filename: 'reel2.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
  { filename: 'reel3.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
  { filename: 'reel4.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4' },

  // Real portrait avatars (Unsplash CC0 / free)
  { filename: 'avatar_youssef.jpg', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80' },
  { filename: 'avatar_mariam.jpg', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80' },
  { filename: 'avatar_karim.jpg', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80' },
  { filename: 'avatar_nour.jpg', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80' },
  { filename: 'avatar_omar.jpg', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80' },

  // High-res social feed, chat media & stories photography
  { filename: 'post_cairo.jpg', url: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=1080&q=82' },
  { filename: 'post_studio.jpg', url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1080&q=82' },
  { filename: 'post_tech1.jpg', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1080&q=82' },
  { filename: 'post_tech2.jpg', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=82' },
  { filename: 'post_nile.jpg', url: 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=1080&q=82' },
  { filename: 'story_1.jpg', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=720&h=1280&q=80' },
  { filename: 'story_2.jpg', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&h=1280&q=80' },
  { filename: 'story_3.jpg', url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=720&h=1280&q=80' },
];

function generateVoiceWav(filepath: string, durationSec = 6.5) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Natural syllable-like envelope for realistic Telegram voice note waveform + soft warm chime tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const syllable =
      Math.max(0, Math.sin(t * 9.5) * 0.65 + Math.sin(t * 4.1) * 0.35) *
      (Math.sin(t * 2.3) > -0.4 ? 1 : 0.08);
    const freq = 220 + 45 * Math.sin(t * 1.8);
    const wave =
      (Math.sin(2 * Math.PI * freq * t) * 0.6 +
        Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.25 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.15) *
      syllable *
      0.35;
    const pcm = Math.max(-32767, Math.min(32767, Math.floor(wave * 32767)));
    buffer.writeInt16LE(pcm, 44 + i * 2);
  }
  fs.writeFileSync(filepath, buffer);
}

async function main() {
  generateVoiceWav(path.join(SEED_DIR, 'voice_note_1.wav'));
  console.log('Generated voice_note_1.wav');

  await Promise.all(
    ASSETS.map(async (item) => {
      const dest = path.join(SEED_DIR, item.filename);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
        console.log('Cached:', item.filename);
        return;
      }
      try {
        const res = await fetch(item.url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(arr));
        console.log(`Downloaded ${item.filename} (${Math.round(arr.byteLength / 1024)} KB)`);
      } catch (e) {
        console.warn(`Failed ${item.filename}:`, e);
      }
    })
  );
}

main();
