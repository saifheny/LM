import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Mic, X, Captions, Loader2, AlertCircle, Sparkles, Music } from 'lucide-react';
import { ChromeArrowButton } from './HardwareUI';
import { apiPost } from '../../lib/api';

const PLACEHOLDER_TRANSCRIPTS = new Set([
  'رسالة صوتية.',
  'رسالة صوتية',
  'نص الرسالة الصوتية',
  'نص الرسالة الصوتية.',
]);

function normalizeStoredTranscript(t?: string | null): string | null {
  const clean = (t || '').trim();
  if (!clean || PLACEHOLDER_TRANSCRIPTS.has(clean)) return null;
  return clean;
}

function fmtAudioSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function buildDeterministicBars(seedStr: string, count = 28): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = Math.imul(hash ^ (i * 31 + 17), 16777619);
    const n = (hash >>> 0) % 100;
    const envelope = Math.sin((i / (count - 1)) * Math.PI);
    bars.push(Math.round(24 + (n * 0.62 + envelope * 28) * 0.85));
  }
  return bars;
}

/**
 * Zero-Latency 2026 Smart Voice Pill & Post Audio Player:
 * - Instant 0ms deterministic waveform bars + tactile draggable playhead scrubber (works before & during playback!)
 * - Slow-down & Speed-up toggle (`0.5x / 0.75x / 1x / 1.5x / 2x`) + REAL Voice-to-Text transcription
 */
const SPEED_STEPS = [0.5, 0.75, 1, 1.5, 2] as const;
type SpeedStep = (typeof SPEED_STEPS)[number];

export function SmartVoicePill({
  url,
  transcript,
  durationSec,
  recordId,
  table,
  title,
  compact = false,
}: {
  url: string;
  transcript?: string | null;
  durationSec?: number;
  recordId?: string;
  table?: 'messages' | 'post_comments' | 'video_comments' | 'ai_messages';
  title?: string | null;
  isMine?: boolean;
  compact?: boolean;
  accent?: 'default' | 'ai';
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const bars = useMemo(() => buildDeterministicBars(url || 'lm-voice', compact ? 24 : 32), [url, compact]);

  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [totalSec, setTotalSec] = useState<number>(durationSec && durationSec > 0 ? durationSec : 0);
  const [curSec, setCurSec] = useState<number>(0);
  const [speed, setSpeed] = useState<SpeedStep>(1);

  const [resolvedTranscript, setResolvedTranscript] = useState<string | null>(() => normalizeStoredTranscript(transcript));
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);

  useEffect(() => {
    const clean = normalizeStoredTranscript(transcript);
    if (clean) setResolvedTranscript(clean);
  }, [transcript]);

  useEffect(() => {
    setPlaying(false);
    setLoadingAudio(false);
    setCurSec(0);
    setTotalSec(durationSec && durationSec > 0 ? durationSec : 0);
  }, [url, durationSec]);

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.playbackRate = speed;
      setLoadingAudio(true);
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          setLoadingAudio(false);
          setPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  }

  function seekToClientX(clientX: number) {
    const audio = audioRef.current;
    const box = waveformRef.current;
    if (!audio || !box) return;
    const rect = box.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1)));
    const targetDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : totalSec;
    if (targetDur > 0) {
      audio.currentTime = ratio * targetDur;
      setCurSec(ratio * targetDur);
    }
  }

  function handleWavePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    draggingRef.current = true;
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    seekToClientX(e.clientX);
  }

  function handleWavePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    e.stopPropagation();
    seekToClientX(e.clientX);
  }

  function handleWavePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function cycleSpeed(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = SPEED_STEPS.indexOf(speed);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  async function handleToggleTranscript(e: React.MouseEvent) {
    e.stopPropagation();
    if (showTranscript && !transcribing) {
      setShowTranscript(false);
      return;
    }
    setShowTranscript(true);
    setTranscribeErr(null);

    if (resolvedTranscript) return;

    setTranscribing(true);
    try {
      const res = await apiPost<{ ok: boolean; transcript?: string; error?: string }>('/api/transcribe', {
        audioUrl: url,
        table,
        recordId,
      });
      if (res.transcript) {
        setResolvedTranscript(res.transcript);
      } else {
        setTranscribeErr(res.error || 'لم يتم رصد كلام واضح في التسجيل.');
      }
    } catch (err) {
      setTranscribeErr(err instanceof Error ? err.message : 'تعذر تحويل الصوت إلى نص الآن.');
    } finally {
      setTranscribing(false);
    }
  }

  const progressRatio = totalSec > 0 ? Math.min(1, curSec / totalSec) : 0;

  return (
    <div className={`space-y-1.5 ${compact ? 'min-w-[195px]' : 'min-w-[225px] sm:min-w-[260px]'}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlaying={() => {
          setLoadingAudio(false);
          setPlaying(true);
        }}
        onPause={() => {
          setLoadingAudio(false);
          setPlaying(false);
        }}
        onEnded={() => {
          setLoadingAudio(false);
          setPlaying(false);
          setCurSec(0);
        }}
        onLoadedMetadata={e => {
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setTotalSec(e.currentTarget.duration);
          }
        }}
        onTimeUpdate={e => {
          setCurSec(e.currentTarget.currentTime);
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && totalSec === 0) {
            setTotalSec(e.currentTarget.duration);
          }
        }}
        onError={() => {
          setLoadingAudio(false);
          setPlaying(false);
        }}
        className="hidden"
      />

      {title && (
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#D4D4D8] truncate px-0.5">
          <Music className="w-3.5 h-3.5 text-[#25F4EE] shrink-0" />
          <span className="truncate">{title}</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-[#F5F5F7] text-black flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-90"
        >
          {loadingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ms-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Interactive Smooth Scrubber Track with Visible Playhead Knob (Drag or Tap Anywhere!) */}
          <div
            ref={waveformRef}
            dir="ltr"
            onPointerDown={handleWavePointerDown}
            onPointerMove={handleWavePointerMove}
            onPointerUp={handleWavePointerUp}
            onPointerCancel={handleWavePointerUp}
            style={{ touchAction: 'none' }}
            className={`relative ${compact ? 'h-6' : 'h-8'} flex items-center gap-[2.5px] cursor-pointer select-none group`}
          >
            {bars.map((pct, i) => {
              const barRatio = (i + 1) / bars.length;
              const filled = barRatio <= progressRatio;
              return (
                <span
                  key={i}
                  style={{ height: `${Math.min(100, Math.max(20, pct))}%` }}
                  className={`flex-1 rounded-full transition-colors duration-75 ${
                    filled ? 'bg-[#25F4EE]' : 'bg-white/24 group-hover:bg-white/35'
                  }`}
                />
              );
            })}
            {/* Tactile Draggable Playhead Thumb */}
            <span
              style={{ left: `${progressRatio * 100}%` }}
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-md transition-transform ${
                dragging ? 'w-3.5 h-3.5 scale-110' : 'w-2.5 h-2.5 group-hover:scale-110'
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[10.5px] font-mono-num text-[#9E9EA8] mt-1 gap-2">
            <span>
              {playing || curSec > 0
                ? `${fmtAudioSec(curSec)}${totalSec > 0 ? ` / ${fmtAudioSec(totalSec)}` : ''}`
                : totalSec > 0
                  ? fmtAudioSec(totalSec)
                  : 'صوتي'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleSpeed}
                title="تغيير سرعة التشغيل (إبطاء / تسريع)"
                className="px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-[#F1F1F2] font-semibold cursor-pointer"
              >
                {speed}x
              </button>
              <button
                type="button"
                onClick={handleToggleTranscript}
                title="تحويل الصوت إلى نص"
                aria-label="تحويل الصوت إلى نص"
                className={`w-6 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  showTranscript ? 'bg-[#F5F5F7] text-black' : 'bg-white/[0.08] hover:bg-white/[0.15] text-[#D4D4D8]'
                }`}
              >
                {transcribing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Captions className="w-3.5 h-3.5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTranscript && (
        <div className="text-[12px] leading-relaxed text-[#E4E4E7] pt-1.5 border-t border-white/[0.08]">
          {transcribing ? (
            <div className="flex items-center gap-1.5 text-[#9E9EA8]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>جارٍ تحويل الصوت إلى نص...</span>
            </div>
          ) : transcribeErr ? (
            <div className="flex items-center justify-between gap-2 text-[#F87171]">
              <span>{transcribeErr}</span>
              <button
                type="button"
                onClick={handleToggleTranscript}
                className="text-[11px] text-white underline shrink-0 cursor-pointer"
              >
                إعادة
              </button>
            </div>
          ) : (
            <span>{resolvedTranscript}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function pickSupportedAudioMime(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === 'undefined') return { mimeType: 'audio/webm', ext: 'webm' };
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mimeType: 'audio/mp4', ext: 'm4a' },
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      // check next
    }
  }
  return { mimeType: '', ext: 'webm' };
}

/**
 * Studio-Grade Live Voice Recorder:
 * - Mounted ONCE (stable refs) so parent re-renders NEVER cut off speech!
 * - Real continuous MediaRecorder chunks (150ms slices) + requestData() flush on stop — ZERO fake fallback sound!
 * - Real-time scrolling RMS amplitude waveform that reacts directly to quiet vs loud voice volume!
 * - Parallel Web Speech API capture + server Gemini audio transcription fallback!
 */
export function LiveVoiceRecorder({
  onCancel,
  onSend,
  accent = 'default',
}: {
  onCancel: () => void;
  onSend: (audioFile: File, durationSec: number, liveTranscript?: string | null) => void;
  accent?: 'default' | 'ai';
}) {
  const BAR_COUNT = 30;
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(12));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const finalSpeechRef = useRef<string>('');
  const interimSpeechRef = useRef<string>('');
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<{ mimeType: string; ext: string }>({ mimeType: 'audio/webm', ext: 'webm' });
  const startMsRef = useRef<number>(Date.now());
  const sendFlagRef = useRef<boolean>(false);

  useEffect(() => {
    let disposed = false;
    let audioCtx: AudioContext | null = null;
    let raf = 0;
    let lastBarPush = 0;
    const timer = window.setInterval(() => {
      if (!disposed) setElapsedMs(Date.now() - startMsRef.current);
    }, 100);

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('المتصفح لا يدعم تسجيل الصوت من الميكروفون.');
      return () => window.clearInterval(timer);
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        if (disposed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        startMsRef.current = Date.now();
        setElapsedMs(0);
        setMicReady(true);

        const picked = pickSupportedAudioMime();
        mimeRef.current = picked;

        const rec = picked.mimeType
          ? new MediaRecorder(stream, { mimeType: picked.mimeType })
          : new MediaRecorder(stream);

        chunksRef.current = [];
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data);
          }
        };

        rec.onstop = () => {
          const sec = Math.max(1, Math.round((Date.now() - startMsRef.current) / 1000));
          stream.getTracks().forEach(t => t.stop());
          try { speechRef.current?.stop(); } catch { /* ignore */ }

          if (sendFlagRef.current && chunksRef.current.length > 0) {
            const actualType = picked.mimeType || rec.mimeType || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type: actualType });
            const file = new File([blob], `voice-${Date.now()}.${picked.ext}`, { type: actualType });
            const combinedText = `${finalSpeechRef.current} ${interimSpeechRef.current}`.trim();
            onSendRef.current(file, sec, combinedText || null);
          }
        };

        recorderRef.current = rec;
        // Slice every 150ms so every single syllable is captured reliably with zero truncation!
        rec.start(150);

        // Optional parallel browser SpeechRecognition (ar-EG) for instant live transcription
        try {
          const w = window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
          };
          const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
          if (SR) {
            const sr = new SR();
            sr.lang = 'ar-EG';
            sr.continuous = true;
            sr.interimResults = true;
            sr.onresult = (ev) => {
              let fin = '';
              let inter = '';
              for (let i = 0; i < ev.results.length; i++) {
                const r = ev.results[i];
                const txt = r?.[0]?.transcript || '';
                if (r.isFinal) fin += `${txt} `;
                else inter += `${txt} `;
              }
              finalSpeechRef.current = fin.trim();
              interimSpeechRef.current = inter.trim();
            };
            sr.onerror = () => {};
            sr.start();
            speechRef.current = sr;
          }
        } catch {
          // Server-side /api/transcribe handles transcription seamlessly
        }

        // True RMS Voice Loudness Analyser (Reacts accurately to soft vs loud voice!)
        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.45;
        src.connect(analyser);

        const timeData = new Uint8Array(analyser.fftSize);
        let peakHold = 0;

        const tick = (now: number) => {
          if (disposed) return;
          analyser.getByteTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const centered = (timeData[i] - 128) / 128;
            sumSq += centered * centered;
          }
          const rms = Math.sqrt(sumSq / timeData.length);
          // Perceptual boost so whispers register softly (~25%) and loud speech peaks clearly (85-100%)
          const level = Math.min(1, Math.pow(Math.max(0, rms - 0.008) * 4.4, 0.72));
          peakHold = Math.max(peakHold, level);

          if (now - lastBarPush >= 68) {
            lastBarPush = now;
            const barHeight = Math.max(12, Math.min(100, Math.round(12 + peakHold * 88)));
            peakHold = 0;
            setBars(prev => [...prev.slice(1), barHeight]);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!disposed) {
          setMicError('يرجى السماح بالوصول للميكروفون من إعدادات المتصفح.');
        }
      });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
      try { speechRef.current?.stop(); } catch { /* ignore */ }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        sendFlagRef.current = false;
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
      audioCtx?.close().catch(() => {});
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const secStr = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="w-full min-h-[52px] rounded-full bg-[#070709]/95 backdrop-blur-xl border border-white/[0.11] ps-2.5 pe-1.5 py-1.5 flex items-center gap-3 text-[#F5F5F7]">
      <button
        type="button"
        onClick={() => {
          sendFlagRef.current = false;
          try { speechRef.current?.stop(); } catch { /* ignore */ }
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          } else {
            streamRef.current?.getTracks().forEach(t => t.stop());
          }
          onCancel();
        }}
        title="إلغاء"
        className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#A1A1AA] flex items-center justify-center cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      {micError ? (
        <div className="flex-1 flex items-center gap-2 text-xs text-[#F87171] min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{micError}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-xs font-mono-num text-[#EF4444] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            {accent === 'ai' ? <Sparkles className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{secStr}s</span>
          </div>

          <div className="flex-1 flex items-center justify-end gap-[2.5px] h-7 overflow-hidden px-1">
            {bars.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`w-[2.5px] rounded-full transition-[height] duration-75 ${
                  h > 65 ? 'bg-white' : h > 28 ? 'bg-[#D4D4D8]' : 'bg-white/35'
                }`}
              />
            ))}
          </div>
        </>
      )}

      <ChromeArrowButton
        size={40}
        disabled={Boolean(micError) || !micReady || sending}
        onClick={() => {
          if (!recorderRef.current || recorderRef.current.state === 'inactive' || sending) return;
          setSending(true);
          sendFlagRef.current = true;
          try {
            recorderRef.current.requestData();
          } catch {
            // ignore if browser doesn't need explicit flush
          }
          // Brief 90ms grace window so the final spoken syllable flushes cleanly into chunksRef!
          window.setTimeout(() => {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
              recorderRef.current.stop();
            }
          }, 90);
        }}
      />
    </div>
  );
}
