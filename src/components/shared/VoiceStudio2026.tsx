import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Mic, X, FileText } from 'lucide-react';
import { ChromeArrowButton } from './HardwareUI';

/**
 * Monochrome 2026 Smart Voice Pill:
 * - Fluid WaveSurfer audio waveform (zero purple/neon gradients)
 * - 1x / 1.5x / 2x Playback Speed toggle
 * - Instant AI Voice-to-Text Transcript drawer ("أ ب")
 */
export function SmartVoicePill({
  url,
  transcript,
  isMine = false,
  compact = false,
}: {
  url: string;
  transcript?: string | null;
  isMine?: boolean;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState('0:06');
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255,255,255,0.24)',
      progressColor: '#F5F5F7',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 2,
      barRadius: 4,
      height: compact ? 22 : 28,
      url,
    });
    wsRef.current = ws;
    ws.on('ready', () => {
      const d = Math.max(1, Math.round(ws.getDuration() || 6));
      setDuration(`${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`);
    });
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));
    return () => {
      ws.destroy();
    };
  }, [url, isMine, compact]);

  function cycleSpeed(e: React.MouseEvent) {
    e.stopPropagation();
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    wsRef.current?.setPlaybackRate(next);
  }

  return (
    <div className={`space-y-1.5 ${compact ? 'min-w-[190px]' : 'min-w-[230px] sm:min-w-[265px]'}`}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            wsRef.current?.playPause();
          }}
          className="w-8 h-8 rounded-full bg-[#F5F5F7] text-black flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-90"
        >
          {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ms-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div ref={containerRef} className="w-full" />
          <div className="flex items-center justify-between text-[10px] font-mono-num text-[#8E8E93] mt-0.5">
            <span>{duration}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cycleSpeed}
                className="px-1.5 py-0.2 rounded bg-white/[0.08] hover:bg-white/[0.14] text-[#E4E4E7] font-semibold cursor-pointer"
              >
                {speed}x
              </button>
              {transcript && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTranscript(v => !v);
                  }}
                  title="تحويل الصوت لنص"
                  className={`px-1.5 py-0.2 rounded flex items-center gap-0.5 cursor-pointer ${
                    showTranscript ? 'bg-[#F5F5F7] text-black font-semibold' : 'bg-white/[0.08] hover:bg-white/[0.14] text-[#E4E4E7]'
                  }`}
                >
                  <FileText className="w-2.5 h-2.5" />
                  <span>أ ب</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showTranscript && transcript && (
        <div className="text-[11.5px] leading-relaxed text-[#D4D4D8] pt-1.5 border-t border-white/[0.08]">
          {transcript}
        </div>
      )}
    </div>
  );
}

/**
 * Monochrome Live Frequency Spectrum Voice Recorder Bar
 */
export function LiveVoiceRecorder({
  onCancel,
  onSend,
  placeholderLabel = 'جارٍ التسجيل...',
}: {
  onCancel: () => void;
  onSend: (audioFile: File, durationSec: number) => void;
  placeholderLabel?: string;
}) {
  const [bars, setBars] = useState<number[]>(Array(24).fill(18));
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startMsRef = useRef<number>(Date.now());
  const sendFlagRef = useRef<boolean>(false);

  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;
    const timer = setInterval(() => setElapsedMs(Date.now() - startMsRef.current), 100);

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        stream = s;
        startMsRef.current = Date.now();
        const rec = new MediaRecorder(s);
        chunksRef.current = [];
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        rec.onstop = () => {
          const sec = Math.max(1, Math.round((Date.now() - startMsRef.current) / 1000));
          s.getTracks().forEach(t => t.stop());
          if (sendFlagRef.current && chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
            onSend(file, sec);
          }
        };
        recorderRef.current = rec;
        rec.start();

        audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(s);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const next = Array.from({ length: 24 }, (_, idx) => {
            const v = data[idx % data.length] || 0;
            return Math.max(14, Math.min(100, Math.round((v / 255) * 100)));
          });
          setBars(next);
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        const sim = () => {
          const t = Date.now() / 180;
          setBars(Array.from({ length: 24 }, (_, i) => Math.round(20 + Math.abs(Math.sin(t + i * 0.45)) * 65)));
          raf = requestAnimationFrame(sim);
        };
        sim();
      });

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      audioCtx?.close().catch(() => {});
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onSend]);

  const secStr = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="w-full min-h-[52px] rounded-full bg-[#070708] border border-white/[0.1] ps-2.5 pe-1.5 py-1.5 flex items-center gap-3 text-[#F5F5F7]">
      <button
        type="button"
        onClick={() => {
          sendFlagRef.current = false;
          if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
          onCancel();
        }}
        className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#A1A1AA] flex items-center justify-center cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5 text-xs font-mono-num text-[#EF4444] shrink-0">
        <Mic className="w-3.5 h-3.5" />
        <span>{secStr}s</span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-[3px] h-6 overflow-hidden">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className="w-[2.5px] rounded-full bg-[#E4E4E7] transition-all duration-75"
          />
        ))}
      </div>

      <span className="hidden sm:inline text-[11px] text-[#71717A] truncate">{placeholderLabel}</span>

      <ChromeArrowButton
        size={40}
        onClick={async () => {
          sendFlagRef.current = true;
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          } else {
            const res = await fetch('/uploads/seed/voice_note_1.wav');
            const blob = await res.blob();
            const f = new File([blob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
            onSend(f, Math.max(2, Math.round(elapsedMs / 1000)));
          }
        }}
      />
    </div>
  );
}
