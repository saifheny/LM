import React from 'react';

export interface TapBurstItem {
  id: number;
  x: number;
  y: number;
  variant: number;
  combo: number;
  rotStart: number;
  rotEnd: number;
  dx: number;
}

const BURST_SHAPES: Array<React.ReactNode> = [
  // 0: Classic Crimson Heart
  <svg key="0" width="52" height="52" viewBox="0 0 48 48" fill="none">
    <path
      d="M24 40.5S7 29.6 7 17.8C7 12.1 11.4 8 16.6 8c3.4 0 6.2 1.8 7.4 4.4C25.2 9.8 28 8 31.4 8 36.6 8 41 12.1 41 17.8 41 29.6 24 40.5 24 40.5z"
      fill="#FF2D55"
    />
  </svg>,
  // 1: Golden 4-Point Sparkle Star
  <svg key="1" width="50" height="50" viewBox="0 0 48 48" fill="none">
    <path
      d="M24 4L28.8 19.2L44 24L28.8 28.8L24 44L19.2 28.8L4 24L19.2 19.2L24 4Z"
      fill="#FACC15"
    />
  </svg>,
  // 2: Coral Flame
  <svg key="2" width="50" height="50" viewBox="0 0 48 48" fill="none">
    <path
      d="M25.5 6C25.5 6 36 14 36 25.5C36 33.5 30.2 40 23.5 40C16.8 40 12 34.5 12 27.5C12 22 15.5 17 18.5 14.5C18.5 19 21 21 21 21C21 15 24 9.5 25.5 6Z"
      fill="#FF6B35"
    />
    <path
      d="M24 24C24 24 29 27.5 29 32.5C29 35.8 26.8 38 23.8 38C21 38 19 35.8 19 32.8C19 29.5 21.5 26 24 24Z"
      fill="#FDE047"
    />
  </svg>,
  // 3: Electric Sky Bolt
  <svg key="3" width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M27 5L11 26H23L20 43L37 21H25L27 5Z" fill="#38BDF8" />
  </svg>,
  // 4: Lavender Diamond Gem
  <svg key="4" width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M15 10H33L42 20L24 40L6 20L15 10Z" fill="#C084FC" />
    <path d="M15 10L24 40L33 10" stroke="#F3E8FF" strokeWidth="1.6" strokeOpacity="0.65" />
  </svg>,
  // 5: Vibrant Mint Flower
  <svg key="5" width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="13" r="8" fill="#34D399" />
    <circle cx="34" cy="21" r="8" fill="#34D399" />
    <circle cx="30" cy="33" r="8" fill="#34D399" />
    <circle cx="18" cy="33" r="8" fill="#34D399" />
    <circle cx="14" cy="21" r="8" fill="#34D399" />
    <circle cx="24" cy="24" r="6" fill="#FEF08A" />
  </svg>,
  // 6: Double Pink Heart Accent
  <svg key="6" width="52" height="52" viewBox="0 0 48 48" fill="none">
    <path
      d="M21 36S8 27.6 8 18.4C8 14 11.4 10.8 15.5 10.8c2.6 0 4.8 1.4 5.5 3.4.7-2 2.9-3.4 5.5-3.4 4.1 0 7.5 3.2 7.5 7.6C34 27.6 21 36 21 36z"
      fill="#F472B6"
    />
    <path
      d="M34 25S27 20.5 27 15.5c0-2.3 1.8-4 4-4 1.4 0 2.6.8 3 1.8.4-1 1.6-1.8 3-1.8 2.2 0 4 1.7 4 4 0 5-7 9.5-7 9.5z"
      fill="#FFFFFF"
    />
  </svg>,
];

export function createTapBurst(x: number, y: number, combo: number): TapBurstItem {
  return {
    id: Date.now() + Math.random(),
    x,
    y,
    variant: combo === 1 ? 0 : Math.floor(Math.random() * BURST_SHAPES.length),
    combo,
    rotStart: Math.round((Math.random() - 0.5) * 28),
    rotEnd: Math.round((Math.random() - 0.5) * 34),
    dx: Math.round((Math.random() - 0.5) * 42),
  };
}

export function TapBurstOverlay({ items }: { items: TapBurstItem[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {items.map(item => (
        <div
          key={item.id}
          style={
            {
              left: `${item.x}px`,
              top: `${item.y}px`,
              '--r0': `${item.rotStart}deg`,
              '--r1': `${Math.round(item.rotStart * 0.5)}deg`,
              '--r2': `${item.rotEnd}deg`,
              '--dx': `${item.dx}px`,
            } as React.CSSProperties
          }
          className="absolute animate-tap-burst flex flex-col items-center"
        >
          {BURST_SHAPES[item.variant % BURST_SHAPES.length]}
          {item.combo >= 3 && (
            <span className="mt-0.5 px-2 py-0.5 rounded-full bg-black/75 border border-white/20 text-[11px] font-mono-num font-bold text-white">
              ×{item.combo}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
