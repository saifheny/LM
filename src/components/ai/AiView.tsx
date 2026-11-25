import React, { useEffect, useState, useRef } from 'react';
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
  Lock,
  FileSearch,
  Wand2,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { UserAvatar } from '../shared/LmBrandMark';

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
  created_at: string;
}

const PROVIDER_MODELS: Record<string, Array<{ id: string; label: string }>> = {
  'local-smart': [{ id: 'lm-context-v1', label: 'LM Smart Local' }],
  gemini: [
    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o', label: 'GPT-4o' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
  ],
  groq: [{ id: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B' }],
  ollama: [{ id: 'llama3.2', label: 'Ollama llama3.2' }],
};

export function AiView() {
  const { user, lang, pendingAiShare, clearPendingAiShare, setActiveTab, refreshUser } = useApp();
  const isAr = lang === 'ar';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [auditOpen, setAuditOpen] = useState(false);
  const [provider, setProvider] = useState('local-smart');
  const [model, setModel] = useState('lm-context-v1');
  const [providerStatus, setProviderStatus] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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

  async function sendPrompt(customPrompt?: string) {
    if (!user) return;
    const text = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!text && !pendingAiShare) return;

    const finalPrompt = text || (isAr ? 'لخّص هذا المحتوى بدقة.' : 'Summarize this shared content.');
    const userMsg: AiMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: pendingAiShare ? `[مشارك بإذنك: ${pendingAiShare.title}]\n${finalPrompt}` : finalPrompt,
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
    <div className="h-full w-full flex bg-[var(--lm-bg)] overflow-hidden">
      {/* ============================================================
          LOBECHAT / CHATGPT COLLAPSIBLE AGENTS & HISTORY SIDEBAR
         ============================================================ */}
      {sidebarOpen && (
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-e border-white/[0.06] bg-[var(--lm-surface)] p-3 justify-between">
          <div className="space-y-4">
            <button
              onClick={() => setMessages([])}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-xs font-semibold flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8774E1]" />
                {isAr ? 'محادثة ذكية جديدة' : 'New Chat'}
              </span>
              <Plus className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--lm-text-muted)]">
                {isAr ? 'وكلاء LM AI المتخصصون' : 'LM AI Agents'}
              </div>
              {[
                { title: isAr ? 'ملخص المنشورات والفيديوهات' : 'Content Summarizer', p: isAr ? 'كيف يمكنني تلخيص منشور أو فيديو قصير على LM؟' : 'How do I summarize posts?' },
                { title: isAr ? 'الباحث داخل منصة LM' : 'LM Platform Explorer', p: isAr ? 'ابحث عن الحسابات والمجتمعات النشطة داخل LM' : 'Search active LM accounts' },
                { title: isAr ? 'صائغ الرسائل الاحترافية' : 'Smart Message Writer', p: isAr ? 'ساعدني في صياغة رسالة احترافية لمستثمر' : 'Draft an investor message' },
                { title: isAr ? 'اختبار جدار العزل المالي' : 'Financial Firewall Test', p: isAr ? 'حوّل 500 جنيه من محفظتي إلى كريم' : 'Transfer $500 to Karim' },
              ].map((ag) => (
                <button
                  key={ag.title}
                  onClick={() => sendPrompt(ag.p)}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[var(--lm-surface-hover)] text-xs text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)] truncate cursor-pointer"
                >
                  {ag.title}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => setAuditOpen(v => !v)}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {isAr ? 'سجل الخصوصية والأمان' : 'Security Audit'}
              </span>
              <span className="font-mono-num text-[10px]">{logs.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="w-full py-2 px-3 rounded-xl hover:bg-[var(--lm-surface-hover)] text-xs text-[var(--lm-text-secondary)] flex items-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isAr ? 'ربط مفاتيح الـ APIs' : 'Configure API Keys'}
            </button>
          </div>
        </aside>
      )}

      {/* ============================================================
          BORDERLESS LOBECHAT / CHATGPT CENTER CANVAS
         ============================================================ */}
      <section className="flex-1 flex flex-col min-w-0 relative">
        {/* Minimal Floating Model Pill Bar */}
        <header className="h-14 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="hidden lg:flex w-9 h-9 rounded-xl hover:bg-[var(--lm-surface-hover)] items-center justify-center text-[var(--lm-text-secondary)] cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--lm-surface)] border border-[var(--lm-border)]">
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="bg-transparent px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="local-smart" className="bg-[#18191E]">LM Smart</option>
                <option value="gemini" className="bg-[#18191E]">Gemini {providerStatus.geminiConfigured ? '●' : ''}</option>
                <option value="openai" className="bg-[#18191E]">OpenAI {providerStatus.openaiConfigured ? '●' : ''}</option>
                <option value="anthropic" className="bg-[#18191E]">Claude {providerStatus.anthropicConfigured ? '●' : ''}</option>
                <option value="openrouter" className="bg-[#18191E]">OpenRouter {providerStatus.openrouterConfigured ? '●' : ''}</option>
                <option value="groq" className="bg-[#18191E]">Groq {providerStatus.groqConfigured ? '●' : ''}</option>
                <option value="ollama" className="bg-[#18191E]">Ollama</option>
              </select>
              <span className="text-[var(--lm-border-strong)]">|</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-transparent px-2.5 py-1 text-xs text-[var(--lm-text-secondary)] font-mono-num outline-none cursor-pointer"
              >
                {(PROVIDER_MODELS[provider] || []).map(m => (
                  <option key={m.id} value={m.id} className="bg-[#18191E]">{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setAuditOpen(v => !v)}
            className="px-3 py-1.5 rounded-full bg-[var(--lm-surface)] border border-[var(--lm-border)] text-[11px] flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>{isAr ? 'معزول ماليًا وخاص' : 'Isolated & Private'}</span>
          </button>
        </header>

        {/* Conversation Area or Clean Center Welcome Screen */}
        <div className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 ? (
            <div className="h-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center space-y-6 py-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#3390EC] to-[#8774E1] flex items-center justify-center text-white shadow-2xl">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {isAr ? `كيف أساعدك اليوم يا ${user.displayName.split(' ')[0]}؟` : `How can I help today, ${user.displayNameEn.split(' ')[0]}?`}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--lm-text-secondary)] max-w-md mx-auto">
                  {isAr
                    ? 'اربِط أي مفتاح API (Gemini / OpenAI / Claude / OpenRouter / Ollama) أو ابدأ فورًا بالمحرك المحلي.'
                    : 'Connect any frontier API or start immediately with the local engine.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                {[
                  { icon: FileSearch, title: isAr ? 'البحث في المنصة' : 'Search LM', desc: isAr ? 'استكشف الحسابات والقنوات' : 'Find creators & channels', p: isAr ? 'ابحث عن الحسابات والمجتمعات النشطة داخل LM' : 'Search active LM accounts' },
                  { icon: Wand2, title: isAr ? 'صياغة احترافية' : 'Draft Reply', desc: isAr ? 'اكتب رسائل ومنشورات متقنة' : 'Write polished messages', p: isAr ? 'ساعدني في صياغة رسالة احترافية لدعوة مستثمر لتجربة LM' : 'Draft an investor invite' },
                  { icon: ShieldAlert, title: isAr ? 'اختبار العزل المالي' : 'Test Firewall', desc: isAr ? 'جرّب طلب تحويل مالي لترى الحظر' : 'Verify zero wallet access', p: isAr ? 'حوّل 500 جنيه من محفظتي إلى كريم' : 'Transfer $500 to Karim' },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      onClick={() => sendPrompt(card.p)}
                      className="p-4 rounded-2xl bg-[var(--lm-surface)] hover:bg-[var(--lm-surface-hover)] border border-[var(--lm-border)] text-start space-y-1.5 transition-all cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[#8774E1]" />
                      <div className="text-xs font-bold">{card.title}</div>
                      <div className="text-[11px] text-[var(--lm-text-muted)]">{card.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3390EC] to-[#8774E1] flex items-center justify-center text-white shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] ${
                      m.role === 'user'
                        ? 'rounded-3xl rounded-ee-md bg-[var(--lm-surface-2)] px-4 py-3 text-sm'
                        : m.blocked
                        ? 'rounded-2xl bg-red-500/10 border border-red-500/35 px-4 py-3 text-sm'
                        : 'flex-1 text-sm leading-relaxed space-y-2'
                    }`}
                  >
                    {m.imagePreview && (
                      <img src={m.imagePreview} alt="" className="max-h-48 rounded-2xl mb-2" />
                    )}
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    </div>
                    {m.provider && (
                      <div className="pt-1.5 flex items-center gap-3 text-[10px] font-mono-num text-[var(--lm-text-muted)]">
                        <span>{m.provider} • {m.model}</span>
                        {m.latencyMs !== undefined && <span>{m.latencyMs}ms</span>}
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <UserAvatar initials={user.avatarInitials} color={user.avatarColor} avatarUrl={user.avatarUrl} size={32} />
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-3 text-xs text-[var(--lm-text-muted)]">
                  <div className="w-7 h-7 rounded-xl bg-[#8774E1]/20 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-[#8774E1]" />
                  </div>
                  <span>{isAr ? 'يفكر...' : 'Thinking...'}</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* FLOATING ROUNDED COMPOSER PILL (ChatGPT / LobeChat Style) */}
        <div className="px-4 pb-5 pt-2 shrink-0">
          <div className="max-w-3xl mx-auto space-y-2">
            {pendingAiShare && (
              <div className="px-4 py-2 rounded-2xl bg-[#8774E1]/15 border border-[#8774E1]/35 flex items-center justify-between text-xs">
                <span className="truncate"><strong>{isAr ? 'محتوى مُشارَك بإذنك:' : 'Consented share:'}</strong> {pendingAiShare.title}</span>
                <button onClick={clearPendingAiShare} className="cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            )}

            {imagePreview && (
              <div className="px-4 py-2 rounded-2xl bg-[var(--lm-surface)] border border-[var(--lm-border)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img src={imagePreview} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  <span>{isAr ? 'صورة مرفقة للتحليل البصري' : 'Image attached'}</span>
                </div>
                <button onClick={() => { setImageBase64(null); setImagePreview(null); }} className="cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); sendPrompt(); }}
              className="rounded-3xl bg-[var(--lm-surface)] border border-[var(--lm-border-strong)] px-3 py-2 flex items-center gap-2 shadow-xl"
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-9 h-9 rounded-full hover:bg-[var(--lm-surface-hover)] flex items-center justify-center text-[var(--lm-text-secondary)] cursor-pointer shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isAr ? 'اسأل LM AI أي شيء...' : 'Message LM AI...'}
                className="flex-1 bg-transparent text-sm outline-none text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)]"
              />

              <button
                type="submit"
                disabled={loading || (!input.trim() && !pendingAiShare)}
                className="w-9 h-9 rounded-full bg-[#8774E1] text-white flex items-center justify-center cursor-pointer disabled:opacity-35 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* SLIDE-OVER SECURITY AUDIT DRAWER */}
      {auditOpen && (
        <aside className="w-80 shrink-0 border-s border-white/[0.07] bg-[var(--lm-surface)] p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--lm-border)]">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isAr ? 'سجل الأمان والعزل المالي' : 'Security Audit Log'}
            </span>
            <button onClick={() => setAuditOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="p-2.5 rounded-xl bg-[var(--lm-surface-2)] text-xs space-y-1">
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
