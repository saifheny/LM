import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Send,
  ShieldCheck,
  Image as ImageIcon,
  X,
  SlidersHorizontal,
  Plus,
  PanelLeft,
  Mic,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { UserAvatar } from '../shared/LmBrandMark';
import { SpatialCompanion3D } from '../shared/Spatial3D';

interface AiMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  blocked?: boolean;
  imagePreview?: string;
}

interface AuditLog {
  id: string;
  action_type: string;
  decision: 'ALLOWED' | 'BLOCKED';
  reason: string;
}

const PROVIDER_MODELS: Record<string, Array<{ id: string; label: string }>> = {
  'local-smart': [{ id: 'lm-context-v1', label: 'LM Spatial Core' }],
  gemini: [
    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o', label: 'GPT-4o' },
  ],
  anthropic: [{ id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' }],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
  ],
  groq: [{ id: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3' }],
  ollama: [{ id: 'llama3.2', label: 'Ollama llama3.2' }],
};

export function AiView() {
  const { user, lang, pendingAiShare, clearPendingAiShare, setActiveTab, refreshUser, toast } = useApp();
  const isAr = lang === 'ar';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [provider, setProvider] = useState('local-smart');
  const [model, setModel] = useState('lm-context-v1');
  const [providerStatus, setProviderStatus] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingTts, setSpeakingTts] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<{ providers: Record<string, unknown> }>('/api/providers')
      .then(d => {
        setProviderStatus(d.providers);
        const defP = String(d.providers.defaultProvider || 'local-smart');
        if (PROVIDER_MODELS[defP]) {
          setProvider(defP);
          setModel(PROVIDER_MODELS[defP][0].id);
        }
      })
      .catch(() => {});
    loadLogs();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  async function loadLogs() {
    const data = await api<{ logs: AuditLog[] }>('/api/ai/security-logs');
    setLogs(data.logs);
  }

  if (!user) return null;

  function speakReply(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#>]/g, '').slice(0, 280);
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = /[\u0600-\u06FF]/.test(clean) ? 'ar-EG' : 'en-US';
    u.onstart = () => setSpeakingTts(true);
    u.onend = () => setSpeakingTts(false);
    u.onerror = () => setSpeakingTts(false);
    window.speechSynthesis.speak(u);
  }

  function startSpeechInput() {
    const Win = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SR) {
      toast(isAr ? 'متصفحك لا يدعم الإملاء الصوتي المباشر — استخدم كتابة الرسالة' : 'Speech recognition unavailable', 'info');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.lang = isAr ? 'ar-EG' : 'en-US';
    rec.interimResults = false;
    setListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      const spoken = ev.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (spoken) {
        setAutoSpeak(true);
        sendPrompt(spoken, true);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  function handleProviderChange(nextP: string) {
    setProvider(nextP);
    const list = PROVIDER_MODELS[nextP];
    if (list && list[0]) setModel(list[0].id);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1] || '');
    };
    reader.readAsDataURL(file);
  }

  async function sendPrompt(customPrompt?: string, forceTts = false) {
    if (!user) return;
    const text = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!text && !pendingAiShare) return;

    const finalPrompt = text || (isAr ? 'لخّص هذا المحتوى.' : 'Summarize this.');
    const userMsg: AiMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: pendingAiShare ? `[${pendingAiShare.title}]\n${finalPrompt}` : finalPrompt,
      imagePreview: imagePreview || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const sharedContext = pendingAiShare?.content;
    const source = pendingAiShare?.source || 'ai_hub';
    if (pendingAiShare) clearPendingAiShare();

    try {
      const res = await api<{
        ok: boolean;
        blocked?: boolean;
        reply: string;
        providerUsed: string;
        modelUsed: string;
        latencyMs: number;
      }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          prompt: finalPrompt,
          provider,
          model,
          source,
          explicitUserConsent: true,
          sharedContext,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageBase64 ? imageMime : undefined,
        }),
      });

      setMessages(prev => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          provider: res.providerUsed,
          model: res.modelUsed,
          latencyMs: res.latencyMs,
          blocked: res.blocked,
        },
      ]);
      if (autoSpeak || forceTts) speakReply(res.reply);
      setImageBase64(null);
      setImagePreview(null);
      await loadLogs();
      await refreshUser();
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: `e_${Date.now()}`, role: 'assistant', text: err instanceof Error ? err.message : 'Error', blocked: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full flex overflow-hidden">
      {sidebarOpen && (
        <aside className="w-[250px] shrink-0 flex-col border-e border-[var(--lm-border)] bg-[var(--tg-sidebar-bg)] backdrop-blur-2xl p-3 flex justify-between">
          <div className="space-y-3">
            <button
              onClick={() => setMessages([])}
              className="w-full py-2.5 px-3.5 rounded-2xl lm-btn-primary text-xs font-bold flex items-center justify-between cursor-pointer"
            >
              <span>{isAr ? 'جلسة جديدة' : 'New Session'}</span>
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="w-full py-2 px-3 rounded-xl bg-[var(--lm-surface-2)] text-xs flex items-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isAr ? 'مفاتيح الـ APIs' : 'API Keys'}
            </button>
          </div>
          <button
            onClick={() => setAuditOpen(v => !v)}
            className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Shield</span>
            <span className="font-mono-num text-[10px]">{logs.length}</span>
          </button>
        </aside>
      )}

      {/* MAIN 3D SPATIAL AI WORKSPACE */}
      <section className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="w-9 h-9 rounded-full liquid-glass flex items-center justify-center cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="liquid-glass rounded-full px-3 py-1 flex items-center gap-2">
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              >
                <option value="local-smart" className="bg-[#12141D]">LM Core</option>
                <option value="gemini" className="bg-[#12141D]">Gemini {providerStatus.geminiConfigured ? '●' : ''}</option>
                <option value="openai" className="bg-[#12141D]">OpenAI {providerStatus.openaiConfigured ? '●' : ''}</option>
                <option value="anthropic" className="bg-[#12141D]">Claude {providerStatus.anthropicConfigured ? '●' : ''}</option>
                <option value="openrouter" className="bg-[#12141D]">OpenRouter {providerStatus.openrouterConfigured ? '●' : ''}</option>
                <option value="groq" className="bg-[#12141D]">Groq {providerStatus.groqConfigured ? '●' : ''}</option>
                <option value="ollama" className="bg-[#12141D]">Ollama</option>
              </select>
              <span className="opacity-30">|</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-transparent text-xs text-[var(--lm-text-secondary)] font-mono-num outline-none cursor-pointer"
              >
                {(PROVIDER_MODELS[provider] || []).map(m => (
                  <option key={m.id} value={m.id} className="bg-[#12141D]">{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (speakingTts && 'speechSynthesis' in window) window.speechSynthesis.cancel();
                setAutoSpeak(v => !v);
              }}
              title={isAr ? 'النطق الصوتي التلقائي' : 'Voice Output'}
              className={`w-9 h-9 rounded-full liquid-glass flex items-center justify-center cursor-pointer ${
                autoSpeak ? 'text-[#38BDF8]' : 'text-[var(--lm-text-secondary)]'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setAuditOpen(v => !v)}
              className="w-9 h-9 rounded-full liquid-glass flex items-center justify-center text-emerald-400 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 ? (
            <div className="h-full max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-5 py-4">
              {/* REAL INTERACTIVE THREE.JS 3D SENTIENT COMPANION */}
              <SpatialCompanion3D speaking={loading || speakingTts} listening={listening} size={210} />

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {listening
                  ? (isAr ? 'أستمع إليك الآن...' : 'Listening...')
                  : (isAr ? `أهلًا ${user.displayName.split(' ')[0]}` : `Hello, ${user.displayNameEn.split(' ')[0]}`)}
              </h1>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { label: isAr ? 'استكشاف المجتمعات' : 'Explore LM', p: isAr ? 'ابحث عن الحسابات والمجتمعات النشطة' : 'Search active LM accounts' },
                  { label: isAr ? 'صياغة رسالة' : 'Draft message', p: isAr ? 'اكتب رسالة سريعة وأنيقة لصديق' : 'Draft a quick stylish message' },
                  { label: isAr ? 'اختبار الحماية المالية' : 'Security Check', p: isAr ? 'حوّل 500 جنيه من محفظتي إلى كريم' : 'Transfer $500 to Karim' },
                ].map((chip) => (
                  <motion.button
                    key={chip.label}
                    whileHover={{ y: -2, scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => sendPrompt(chip.p)}
                    className="px-4 py-2 rounded-full lm-card hover:border-[var(--lm-accent)]/50 text-xs font-semibold cursor-pointer"
                  >
                    {chip.label}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4 space-y-5">
              {/* Compact Floating 3D Companion Header while chatting */}
              <div className="flex justify-center">
                <SpatialCompanion3D speaking={loading || speakingTts} listening={listening} size={96} />
              </div>

              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7C5CFF] to-[#38BDF8] flex items-center justify-center text-white shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] ${
                      m.role === 'user'
                        ? 'rounded-3xl rounded-ee-md lm-btn-primary px-4 py-2.5 text-sm'
                        : m.blocked
                        ? 'rounded-3xl bg-red-500/12 border border-red-500/35 px-4 py-3 text-sm'
                        : 'lm-card rounded-3xl rounded-es-md px-4 py-3 text-sm leading-relaxed'
                    }`}
                  >
                    {m.imagePreview && <img src={m.imagePreview} alt="" className="max-h-48 rounded-2xl mb-2" />}
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    </div>
                    {m.provider && (
                      <div className="pt-1.5 flex items-center justify-between gap-3 text-[10px] font-mono-num text-[var(--lm-text-muted)]">
                        <span>{m.model}</span>
                        <button
                          type="button"
                          onClick={() => speakReply(m.text)}
                          className="hover:text-[var(--lm-accent)] cursor-pointer flex items-center gap-1"
                        >
                          <Volume2 className="w-3 h-3" /> {m.latencyMs}ms
                        </button>
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <UserAvatar initials={user.avatarInitials} color={user.avatarColor} avatarUrl={user.avatarUrl} size={32} />
                  )}
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* FLOATING 2026 VOICE + MULTIMODAL COMPOSER */}
        <div className="px-4 pb-3 pt-1 shrink-0">
          <div className="max-w-2xl mx-auto space-y-2">
            {pendingAiShare && (
              <div className="px-4 py-2 rounded-2xl liquid-glass flex items-center justify-between text-xs">
                <span className="truncate">{pendingAiShare.title}</span>
                <button onClick={clearPendingAiShare} className="cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            )}

            {imagePreview && (
              <div className="px-4 py-2 rounded-2xl liquid-glass flex items-center justify-between text-xs">
                <img src={imagePreview} alt="" className="w-8 h-8 rounded-lg object-cover" />
                <button onClick={() => { setImageBase64(null); setImagePreview(null); }} className="cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); sendPrompt(); }}
              className="h-13 rounded-full liquid-glass px-2.5 flex items-center gap-2"
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-[var(--lm-text-secondary)] cursor-pointer shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isAr ? 'تحدث أو اسأل LM AI...' : 'Talk or ask LM AI...'}
                className="flex-1 bg-transparent text-sm outline-none text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)]"
              />

              <button
                type="button"
                onClick={startSpeechInput}
                title={isAr ? 'تحدث بصوتك مباشرةً' : 'Live Voice Talk'}
                className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all ${
                  listening ? 'bg-[#FF2D55] text-white animate-pulse' : 'hover:bg-white/10 text-[var(--lm-text-secondary)]'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={loading || (!input.trim() && !pendingAiShare)}
                className="w-9 h-9 rounded-full lm-btn-primary flex items-center justify-center cursor-pointer disabled:opacity-35 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {auditOpen && (
        <aside className="w-76 shrink-0 border-s border-[var(--lm-border)] bg-[var(--tg-sidebar-bg)] backdrop-blur-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--lm-border)]">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Shield Log
            </span>
            <button onClick={() => setAuditOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="p-2.5 rounded-2xl bg-[var(--lm-surface-2)] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono-num text-[10px] font-bold">{l.action_type}</span>
                  <span className={`text-[9px] font-mono-num px-1.5 py-0.5 rounded font-bold ${
                    l.decision === 'BLOCKED' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {l.decision}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--lm-text-secondary)]">{l.reason}</p>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
