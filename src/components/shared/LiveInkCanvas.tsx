import React, { useEffect, useRef, useState } from 'react';
import { X, Undo2, Trash2, Send, RotateCcw } from 'lucide-react';

export interface InkStroke {
  color: string;
  width: number;
  points: Array<[number, number]>;
}

const INK_COLORS = [
  { id: 'cyan', hex: '#38BDF8' },
  { id: 'violet', hex: '#A78BFA' },
  { id: 'gold', hex: '#F5C451' },
  { id: 'rose', hex: '#FF2D55' },
  { id: 'emerald', hex: '#34D399' },
  { id: 'white', hex: '#FFFFFF' },
];

/**
 * Live Neon Handwriting & Sketch Pad Modal
 * Users draw or write freely with glowing neon ink; sends exact animated stroke paths!
 */
export function InkComposerModal({
  onClose,
  onSend,
  isAr,
}: {
  onClose: () => void;
  onSend: (serializedSketch: string) => void;
  isAr: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState('#38BDF8');
  const [width, setWidth] = useState(4.5);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<InkStroke | null>(null);

  const redraw = (list: InkStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const s of list) {
      if (s.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 14;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i][0], s.points[i][1]);
      }
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    redraw(strokes);
  }, [strokes]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = e.currentTarget.width / rect.width;
    const scaleY = e.currentTarget.height / rect.height;
    return [Math.round((e.clientX - rect.left) * scaleX), Math.round((e.clientY - rect.top) * scaleY)];
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getPoint(e);
    const next: InkStroke = { color, width, points: [pt] };
    currentStrokeRef.current = next;
    setStrokes(prev => [...prev, next]);
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const pt = getPoint(e);
    currentStrokeRef.current.points.push(pt);
    redraw(strokes);
  }

  function handleUp() {
    drawingRef.current = false;
    currentStrokeRef.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md liquid-glass rounded-3xl p-4 space-y-3 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">{isAr ? '✍️ لوح الكتابة والرسم الحي (نيون)' : '✍️ Live Neon Ink Pad'}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={360}
          height={220}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          className="w-full aspect-[360/220] rounded-2xl bg-[#07080F] border border-white/12 touch-none cursor-crosshair"
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {INK_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                  color === c.hex ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={2}
              max={9}
              step={0.5}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-16 accent-[#38BDF8]"
            />
            <button
              type="button"
              onClick={() => setStrokes(prev => prev.slice(0, -1))}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
              title="تراجع"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
              title="مسح"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={strokes.length === 0}
          onClick={() => onSend(JSON.stringify({ strokes }))}
          className="w-full py-2.5 rounded-full lm-btn-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          <span>{isAr ? 'إرسال ككتابة حية متحركة' : 'Send Animated Ink'}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Replays an Ink Sketch message stroke-by-stroke with a glowing animated laser pen tip!
 */
export function AnimatedInkPlayer({ serialized }: { serialized: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let strokes: InkStroke[] = [];
    try {
      strokes = (JSON.parse(serialized) as { strokes: InkStroke[] }).strokes || [];
    } catch {
      return;
    }

    // Flatten animation steps
    const segments: Array<{ color: string; width: number; from: [number, number]; to: [number, number] }> = [];
    for (const s of strokes) {
      for (let i = 1; i < s.points.length; i++) {
        segments.push({ color: s.color, width: s.width, from: s.points[i - 1], to: s.points[i] });
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let idx = 0;
    let raf = 0;

    const step = () => {
      const batch = Math.max(1, Math.ceil(segments.length / 45));
      for (let k = 0; k < batch && idx < segments.length; k++, idx++) {
        const seg = segments[idx];
        ctx.save();
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = seg.width;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 12;
        ctx.shadowColor = seg.color;
        ctx.beginPath();
        ctx.moveTo(seg.from[0], seg.from[1]);
        ctx.lineTo(seg.to[0], seg.to[1]);
        ctx.stroke();
        ctx.restore();
      }
      if (idx < segments.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [serialized, playKey]);

  return (
    <div className="relative rounded-2xl bg-[#07080F]/90 border border-white/10 overflow-hidden">
      <canvas ref={canvasRef} width={300} height={160} className="w-[240px] sm:w-[270px] h-[135px] block" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPlayKey(k => k + 1); }}
        title="إعادة تشغيل الرسم الحي"
        className="absolute top-2 end-2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
