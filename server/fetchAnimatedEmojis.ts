import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMOJI_DIR = path.resolve(__dirname, '../uploads/emojis');
if (!fs.existsSync(EMOJI_DIR)) fs.mkdirSync(EMOJI_DIR, { recursive: true });

// Open-source Google Noto Animated Emoji (Apache 2.0) + Microsoft Fluent 3D Animated Emoji (MIT)
const PACK: Array<{ id: string; unicode: string; notoCode: string; fluentPath: string }> = [
  { id: 'fire', unicode: '🔥', notoCode: '1f525', fluentPath: 'Travel%20and%20places/Fire.png' },
  { id: 'bolt', unicode: '⚡', notoCode: '26a1', fluentPath: 'Travel%20and%20places/High%20Voltage.png' },
  { id: 'rocket', unicode: '🚀', notoCode: '1f680', fluentPath: 'Travel%20and%20places/Rocket.png' },
  { id: 'crown', unicode: '👑', notoCode: '1f451', fluentPath: 'Objects/Crown.png' },
  { id: 'gem', unicode: '💎', notoCode: '1f48e', fluentPath: 'Objects/Gem%20Stone.png' },
  { id: 'party', unicode: '🎉', notoCode: '1f389', fluentPath: 'Activities/Party%20Popper.png' },
  { id: 'mindblown', unicode: '🤯', notoCode: '1f92f', fluentPath: 'Smilies/Exploding%20Head.png' },
  { id: 'heartfire', unicode: '❤️‍🔥', notoCode: '2764_fe0f_200d_1f525', fluentPath: 'Smilies/Heart%20on%20Fire.png' },
  { id: 'starstruck', unicode: '🤩', notoCode: '1f929', fluentPath: 'Smilies/Star-Struck.png' },
  { id: 'laugh', unicode: '😂', notoCode: '1f602', fluentPath: 'Smilies/Face%20with%20Tears%20of%20Joy.png' },
  { id: 'cool', unicode: '😎', notoCode: '1f60e', fluentPath: 'Smilies/Smiling%20Face%20with%20Sunglasses.png' },
  { id: 'ghost', unicode: '👻', notoCode: '1f47b', fluentPath: 'Smilies/Ghost.png' },
  { id: 'alien', unicode: '👽', notoCode: '1f47d', fluentPath: 'Smilies/Alien.png' },
  { id: 'dice', unicode: '🎲', notoCode: '1f3b2', fluentPath: 'Activities/Game%20Die.png' },
  { id: 'target', unicode: '🎯', notoCode: '1f3af', fluentPath: 'Activities/Direct%20Hit.png' },
  { id: 'slot', unicode: '🎰', notoCode: '1f3b0', fluentPath: 'Activities/Slot%20Machine.png' },
  { id: 'clap', unicode: '👏', notoCode: '1f44f', fluentPath: 'Hand%20gestures/Clapping%20Hands.png' },
  { id: 'hundred', unicode: '💯', notoCode: '1f4af', fluentPath: 'Smilies/Hundred%20Points.png' },
];

async function main() {
  for (const item of PACK) {
    const destWebp = path.join(EMOJI_DIR, `${item.id}.webp`);
    const destPng = path.join(EMOJI_DIR, `${item.id}.png`);
    if (fs.existsSync(destPng) && fs.statSync(destPng).size > 2000) {
      console.log('Cached 3D:', item.id);
      continue;
    }

    // Try Microsoft Fluent 3D Animated PNG first (ultra-glossy 3D animated!)
    const fluentUrl = `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/${item.fluentPath}`;
    let ok = false;
    try {
      const r = await fetch(fluentUrl, { signal: AbortSignal.timeout(12000) });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.byteLength > 2000) {
          fs.writeFileSync(destPng, buf);
          console.log(`3D FLUENT OK: ${item.id}.png (${Math.round(buf.byteLength / 1024)} KB)`);
          ok = true;
        }
      }
    } catch {
      // fallback to Noto Animated WebP
    }

    if (!ok) {
      const notoUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${item.notoCode}/512.webp`;
      try {
        const r = await fetch(notoUrl, { signal: AbortSignal.timeout(12000) });
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.byteLength > 1000) {
            fs.writeFileSync(destWebp, buf);
            console.log(`NOTO ANIM OK: ${item.id}.webp (${Math.round(buf.byteLength / 1024)} KB)`);
          }
        }
      } catch (e) {
        console.warn(`Failed ${item.id}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }
}

main();
