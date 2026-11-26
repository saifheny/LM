import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Mic, X, Captions, Loader2, AlertCircle, Sparkles } from 'lucide-react';
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

/**
 * Monochrome Smart Voice Pill:
 * - WaveSurfer real audio waveform + reliable HTMLAudio fallback
 * - 1x / 1.5x / 2x Playback Speed toggle
 * - REAL Voice-to-Text transcription via Captions icon (live cache + server Gemini/Whisper /api/transcribe)
 */
export function SmartVoicePill({
  url,
  transcript,
  recordId,
  table,
  isMine = false,
  compact = false,
  accent = 'default',
}: {
  url: string;
  transcript?: string | null;
  recordId?: string;
  table?: 'messages' | 'post_comments' | 'video_comments' | 'ai_messages';
  isMine?: boolean;
  compact?: boolean;
  accent?: 'default' | 'ai';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const [wsFailed, setWsFailed] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const [resolvedTranscript, setResolvedTranscript] = useState<string | null>(() => normalizeStoredTranscript(transcript));
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);

  useEffect(() => {
    const clean = normalizeStoredTranscript(transcript);
    if (clean) setResolvedTranscript(clean);
  }, [transcript]);

  useEffect(() => {
    setWsFailed(false);
    setPlaying(false);
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
      const d = Math.max(1, Math.round(ws.getDuration() || 1));
      setDuration(`${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`);
    });
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));
    ws.on('error', () => {
      setWsFailed(true);
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [url, isMine, compact, accent]);

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    if (!wsFailed && wsRef.current) {
      wsRef.current.playPause();
      return;
    }
    const audio = fallbackAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.playbackRate = speed;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function cycleSpeed(e: React.MouseEvent) {
    e.stopPropagation();
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    wsRef.current?.setPlaybackRate(next);
    if (fallbackAudioRef.current) fallbackAudioRef.current.playbackRate = next;
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

  return (
    <div className={`space-y-1.5 ${compact ? 'min-w-[200px]' : 'min-w-[235px] sm:min-w-[270px]'}`}>
      {wsFailed && (
        <audio
          ref={fallbackAudioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={e => {
            const d = Math.max(1, Math.round(e.currentTarget.duration || 1));
            setDuration(`${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`);
          }}
          className="hidden"
        />
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-[#F5F5F7] text-black flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-90"
        >
          {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ms-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div ref={containerRef} className={`w-full ${wsFailed ? 'hidden' : ''}`} />
          {wsFailed && (
            <div className="h-6 flex items-center gap-[3px] px-1">
              {Array.from({ length: 22 }).map((_, i) => (
                <span
                  key={i}
                  style={{ height: `${28 + ((i * 37) % 58)}%` }}
                  className={`flex-1 rounded-full ${playing ? 'bg-white/80' : 'bg-white/25'}`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] font-mono-num text-[#8E8E93] mt-0.5">
            <span>{duration}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleSpeed}
                className="px-1.5 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#E4E4E7] font-semibold cursor-pointer"
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
