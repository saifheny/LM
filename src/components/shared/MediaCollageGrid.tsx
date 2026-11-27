import React from 'react';

export function parseMediaUrls(mediaUrl?: string | null): string[] {
  if (!mediaUrl || typeof mediaUrl !== 'string') return [];
  const trimmed = mediaUrl.trim();
  if (!trimmed || trimmed.startsWith('lm:')) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === 'string' && u.length > 0 && !u.startsWith('lm:'));
      }
    } catch {
      return [];
    }
  }
  return [trimmed];
}

/**
 * Telegram / iOS Seamless Photo Collage Grid:
 * - 1 photo: crisp full-bleed rounded image
 * - 2 photos: 50/50 side-by-side split
 * - 3 photos: hero tall tile (62%) + 2 stacked tiles (38%)
 * - 4+ photos: hero tall tile (66%) + 3 stacked tiles (34%) with +N counter badge
 */
export function MediaCollageGrid({
  urls,
  compact = false,
  onSelect,
  overlayBadge,
}: {
  urls: string[];
  compact?: boolean;
  onSelect?: (index: number) => void;
  overlayBadge?: React.ReactNode;
}) {
  const valid = urls.filter(u => Boolean(u) && !u.startsWith('lm:'));
  if (valid.length === 0) return null;

  const heightClass = compact
    ? valid.length === 2
      ? 'h-[210px] sm:h-[235px]'
      : 'h-[260px] sm:h-[295px]'
    : valid.length === 2
      ? 'h-[270px] sm:h-[320px]'
      : 'h-[320px] sm:h-[390px]';

  const handleClick = (idx: number) => (e: React.MouseEvent) => {
    if (!onSelect) return;
    e.stopPropagation();
    onSelect(idx);
  };

  if (valid.length === 1) {
    return (
      <div className="relative w-full overflow-hidden rounded-[15px] bg-[#0B121B]">
        <img
          src={valid[0]}
          alt=""
          loading="lazy"
          decoding="async"
          onClick={handleClick(0)}
          className={`w-full ${compact ? 'max-h-[320px]' : 'max-h-[450px]'} object-cover block ${
            onSelect ? 'cursor-pointer hover:brightness-[1.03] transition-[filter]' : ''
          }`}
        />
        {overlayBadge}
      </div>
    );
  }

  if (valid.length === 2) {
    return (
      <div className={`relative w-full ${heightClass} grid grid-cols-2 gap-[3px] overflow-hidden rounded-[15px] bg-[#0B121B]`}>
        {valid.map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={handleClick(idx)}
            className={`w-full h-full object-cover block ${
              onSelect ? 'cursor-pointer hover:brightness-[1.05] transition-[filter]' : ''
            }`}
          />
        ))}
        {overlayBadge}
      </div>
    );
  }

  if (valid.length === 3) {
    return (
      <div className={`relative w-full ${heightClass} grid grid-cols-12 gap-[3px] overflow-hidden rounded-[15px] bg-[#0B121B]`}>
        <div className="col-span-7 h-full overflow-hidden">
          <img
            src={valid[0]}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={handleClick(0)}
            className={`w-full h-full object-cover block ${
              onSelect ? 'cursor-pointer hover:brightness-[1.05] transition-[filter]' : ''
            }`}
          />
        </div>
        <div className="col-span-5 h-full grid grid-rows-2 gap-[3px] overflow-hidden">
          {valid.slice(1, 3).map((url, idx) => (
            <img
              key={idx + 1}
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              onClick={handleClick(idx + 1)}
              className={`w-full h-full object-cover block ${
                onSelect ? 'cursor-pointer hover:brightness-[1.05] transition-[filter]' : ''
              }`}
            />
          ))}
        </div>
        {overlayBadge}
      </div>
    );
  }

  // 4+ photos: Iconic Telegram Hero + 3 Stacked Side Tiles!
  const extraCount = valid.length - 4;
  return (
    <div className={`relative w-full ${heightClass} grid grid-cols-12 gap-[3px] overflow-hidden rounded-[15px] bg-[#0B121B]`}>
      <div className="col-span-8 h-full overflow-hidden">
        <img
          src={valid[0]}
          alt=""
          loading="lazy"
          decoding="async"
          onClick={handleClick(0)}
          className={`w-full h-full object-cover block ${
            onSelect ? 'cursor-pointer hover:brightness-[1.05] transition-[filter]' : ''
          }`}
        />
      </div>
      <div className="col-span-4 h-full grid grid-rows-3 gap-[3px] overflow-hidden">
        {valid.slice(1, 4).map((url, idx) => {
          const tileIndex = idx + 1;
          const isLastWithExtra = idx === 2 && extraCount > 0;
          return (
            <div key={tileIndex} className="relative w-full h-full overflow-hidden">
              <img
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                onClick={handleClick(tileIndex)}
                className={`w-full h-full object-cover block ${
                  onSelect ? 'cursor-pointer hover:brightness-[1.05] transition-[filter]' : ''
                }`}
              />
              {isLastWithExtra && (
                <button
                  type="button"
                  onClick={handleClick(tileIndex)}
                  className="absolute inset-0 bg-[#0B121B]/65 backdrop-blur-[2px] flex items-center justify-center text-white text-base font-bold cursor-pointer"
                >
                  +{extraCount}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {overlayBadge}
    </div>
  );
}
