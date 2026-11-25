import React, { useEffect, useState, useRef } from 'react';
import {
  Cpu,
  Send,
  ShieldCheck,
  ShieldAlert,
  Image as ImageIcon,
  X,
  Lock,
  SlidersHorizontal,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { RichMessageText } from '../shared/LmBrandMark';

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
  'local-smart': [{ id: 'lm-context-v1', label: 'LM Local Smart Engine (0 EGP)' }],
  gemini: [
    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Balanced)' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon (Fast Frontier)' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Ultra-Fast)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o', label: 'GPT-4o' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (Open Source)' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
    { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq Ultra-Fast)' },
  ],
  ollama: [
    { id: 'llama3.2', label: 'Ollama Local: llama3.2' },
    { id: 'qwen2.5', label: 'Ollama Local: qwen2.5' },
  ],
};

export function AiView() {
  const { user, lang, pendingAiShare, clearPendingAiShare, setActiveTab, refreshUser } = useApp();
  const isAr = lang === 'ar';

  const [provider, setProvider] = useState('local-smart');
  const [model, setModel] = useState('lm-context-v1');
  const [providerStatus, setProviderStatus] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<AiMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: isAr
        ? 'مرحبًا بك في **LM AI** — مساعدك اليومي المدمج داخل المنصة.\n\n• يمكنك تلخيص المنشورات والفيديوهات وتحليل الصور والبحث داخل LM وصياغة الرسائل.\n• يمكنك ربط مفاتيح API من **Gemini / OpenAI / Claude / OpenRouter / Groq / Ollama** في ثوانٍ من مركز الـ APIs.\n• الخصوصية والأمان مضمونان على مستوى الخادم: لا أقرأ محادثاتك الخاصة تلقائيًا، ولا أملك أي صلاحية مالية.'
        : 'Welcome to **LM AI** — your integrated platform assistant with strict privacy and zero financial authority.',
      provider: 'LM AI Core',
      model: 'Privacy-First',
    },
  ]);
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
      const b64 = dataUrl.split(',')[1] || '';
      setImageBase64(b64);
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
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Error contacting LM AI',
          blocked: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const tierLimitMap: Record<string, number> = { free: 15, ai_20: 60, ai_50: 180, ai_100: 500, ai_200: 2000 };
  const dailyLimit = tierLimitMap[user.aiTier] || 15;

  return (
    <div className="h-full w-full overflow-y-auto lg:overflow-hidden px-4 sm:px-6 py-4">
      <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* MAIN AI WORKSPACE (8 cols) */}
        <div className="lg:col-span-8 lm-card rounded-2xl flex flex-col min-h-[540px] lg:h-full overflow-hidden">
          {/* Header with Multi-Provider Switcher */}
          <div className="p-3.5 border-b border-[var(--lm-border)] bg-[var(--lm-surface)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--lm-accent-soft)] border border-[var(--lm-accent)]/35 flex items-center justify-center text-[var(--lm-accent)]">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">LM AI Studio</div>
                <div className="text-[10px] font-mono-num text-[var(--lm-text-muted)]">
                  {user.aiUsedToday} / {dailyLimit} {isAr ? 'طلب اليوم' : 'req today'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="lm-input rounded-lg px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="local-smart">LM Local Engine (Ready)</option>
                <option value="gemini">Google Gemini {providerStatus.geminiConfigured ? '●' : '(Add Key)'}</option>
                <option value="openai">OpenAI {providerStatus.openaiConfigured ? '●' : '(Add Key)'}</option>
                <option value="anthropic">Anthropic Claude {providerStatus.anthropicConfigured ? '●' : '(Add Key)'}</option>
                <option value="openrouter">OpenRouter {providerStatus.openrouterConfigured ? '●' : '(Add Key)'}</option>
                <option value="groq">Groq {providerStatus.groqConfigured ? '●' : '(Add Key)'}</option>
                <option value="ollama">Ollama (Local Open-Source)</option>
              </select>

              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="lm-input rounded-lg px-2.5 py-1.5 text-xs font-mono-num"
              >
                {(PROVIDER_MODELS[provider] || []).map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>

              <button
                onClick={() => setActiveTab('settings')}
                className="lm-btn-ghost px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {isAr ? 'مفاتيح API' : 'API Keys'}
              </button>
            </div>
          </div>

          {/* Optional AI Section Platform Ad (Hidden when user removes AI ads - 50 EGP) */}
          {!user.adRemoval.ai && (
            <div className="px-4 py-2 bg-[var(--lm-surface-2)] border-b border-[var(--lm-border)] flex items-center justify-between text-[11px] shrink-0">
              <span className="text-[var(--lm-text-secondary)]">
                {isAr ? 'إعلان قسم الذكاء الاصطناعي • يمكنك إزالته مقابل 50 ج.م شهريًا.' : 'AI Section Ad • Remove for 50 EGP/mo.'}
              </span>
              <button onClick={() => setActiveTab('vip')} className="text-[var(--lm-accent)] font-semibold hover:underline cursor-pointer">
                {isAr ? 'إزالة' : 'Remove'}
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line border ${
                    m.blocked
                      ? 'bg-red-500/10 border-red-500/35 text-[var(--lm-text)]'
                      : m.role === 'user'
                      ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)] border-transparent'
                      : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] text-[var(--lm-text)]'
                  }`}
                >
                  {m.imagePreview && (
                    <img src={m.imagePreview} alt="Attached" className="max-h-40 rounded-lg mb-2 border border-white/10" />
                  )}
                  <RichMessageText text={m.text} />
                  {m.provider && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-3 text-[10px] font-mono-num opacity-70">
                      <span>{m.provider} • {m.model}</span>
                      {m.latencyMs !== undefined && <span>{m.latencyMs}ms</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-[var(--lm-text-muted)] px-2 animate-pulse">
                {isAr ? 'LM AI يعالج طلبك...' : 'LM AI is processing...'}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="px-4 py-2 border-t border-[var(--lm-border)] flex items-center gap-1.5 overflow-x-auto shrink-0">
            {[
              { label: isAr ? '🔍 ابحث عن الحسابات والمجتمعات' : '🔍 Search LM accounts', prompt: isAr ? 'ابحث عن الحسابات والمجتمعات النشطة داخل LM' : 'Search LM accounts and communities' },
              { label: isAr ? '✉️ صياغة رسالة احترافية' : '✉️ Draft message', prompt: isAr ? 'ساعدني في صياغة رسالة احترافية لدعوة مستثمر لتجربة LM' : 'Draft an investor invite message' },
              { label: isAr ? '🛡️ اختبار العزل المالي (تحويل 500 ج.م)' : '🛡️ Test Financial Block', prompt: isAr ? 'حوّل 500 جنيه من محفظتي إلى كريم' : 'Transfer $500 from my wallet to Karim' },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => sendPrompt(q.prompt)}
                className="px-2.5 py-1 rounded-lg bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] border border-[var(--lm-border)] text-[11px] whitespace-nowrap cursor-pointer"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Pending Explicit Share Banner */}
          {pendingAiShare && (
            <div className="px-4 py-2 bg-[var(--lm-accent-soft)] border-t border-[var(--lm-accent)]/30 flex items-center justify-between text-xs shrink-0">
              <span className="truncate">
                <strong>{isAr ? 'محتوى مُشارَك بإذنك:' : 'Shared with consent:'}</strong> {pendingAiShare.title}
              </span>
              <button onClick={clearPendingAiShare} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {/* Attached Image Preview */}
          {imagePreview && (
            <div className="px-4 py-2 bg-[var(--lm-surface-2)] border-t border-[var(--lm-border)] flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <img src={imagePreview} alt="Upload" className="w-8 h-8 rounded object-cover" />
                <span>{isAr ? 'صورة جاهزة للتحليل البصري' : 'Image ready for analysis'}</span>
              </div>
              <button onClick={() => { setImageBase64(null); setImagePreview(null); }} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendPrompt(); }}
            className="p-3 border-t border-[var(--lm-border)] bg-[var(--lm-surface)] flex items-center gap-2 shrink-0"
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title={isAr ? 'إرفاق صورة للتحليل' : 'Attach image for analysis'}
              className="w-9 h-9 rounded-xl lm-btn-ghost flex items-center justify-center shrink-0 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isAr ? 'اسأل LM AI، لخّص محتوى، أو اختبر جدار الحماية المالي...' : 'Ask LM AI...'}
              className="lm-input flex-1 rounded-xl px-3.5 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !pendingAiShare)}
              className="lm-btn-primary px-4 h-9 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
            >
              <Send className="w-3.5 h-3.5" />
              {isAr ? 'إرسال' : 'Send'}
            </button>
          </form>
        </div>

        {/* RIGHT SECURITY & PERMISSION FIREWALL PANEL (4 cols) */}
        <aside className="lg:col-span-4 flex flex-col gap-4 lg:h-full lg:overflow-y-auto">
          <div className="lm-card rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isAr ? 'مصفوفة صلاحيات LM AI (مفروضة على الخادم)' : 'Server-Enforced AI Permissions'}
            </h3>
            <div className="space-y-2 text-xs">
              {[
                { label: isAr ? 'قراءة المحادثات الخاصة تلقائيًا' : 'Auto-read Private Chats', allowed: false },
                { label: isAr ? 'التحويلات المالية وتعديل الأرصدة' : 'Financial Transfers & Balances', allowed: false },
                { label: isAr ? 'تلخيص المنشورات والمحتوى المُشارَك بإذنك' : 'Consented Post/Chat Summaries', allowed: true },
                { label: isAr ? 'تحليل الصور والبحث العام داخل LM' : 'Image Analysis & Public Search', allowed: true },
              ].map((rule) => (
                <div key={rule.label} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)]">
                  <span className="text-[11px]">{rule.label}</span>
                  {rule.allowed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono-num text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> ALLOWED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono-num text-red-400 shrink-0">
                      <Ban className="w-3 h-3" /> BLOCKED
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Security Audit Trail */}
          <div className="lm-card rounded-2xl p-4 space-y-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[var(--lm-accent)]" />
                {isAr ? 'سجل مراجعة الأمان والخصوصية (مباشر)' : 'Live Security Audit Log'}
              </h3>
              <span className="text-[10px] font-mono-num text-[var(--lm-text-muted)]">{logs.length}</span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {logs.map((l) => (
                <div key={l.id} className="p-2.5 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono-num font-semibold truncate">{l.action_type}</span>
                    <span
                      className={`text-[9px] font-mono-num px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        l.decision === 'BLOCKED'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {l.decision}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--lm-text-secondary)] leading-snug">{l.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
