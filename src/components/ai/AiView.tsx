import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Plus,
  KeyRound,
  ExternalLink,
  X,
} from 'lucide-react';

import { Lang, UserProfile } from '../../types';
import { LmBrandMark } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { MobileInlineNavTrigger } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { apiGet, apiPost } from '../../lib/api';

interface AiViewProps {
  user: UserProfile;
  lang: Lang;
}

interface AiTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  feedback?: 'up' | 'down' | null;
  needsApiKey?: boolean;
  missingProvider?: string;
}

interface ModelChoice {
  provider: 'local-smart' | 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'ollama';
  model: string;
  label: string;
  configField?: string;
  keyUrl?: string;
  steps?: string[];
  placeholder?: string;
}

const MODEL_CHOICES: ModelChoice[] = [
  { provider: 'local-smart', model: 'lm-local-v2', label: 'LM Local' },
  {
    provider: 'gemini',
    model: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    configField: 'geminiApiKey',
    keyUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIzaSy...',
    steps: [
      'افتح Google AI Studio من الرابط أدناه وسجّل الدخول بحساب Google.',
      'اضغط Create API Key وانسخ المفتاح.',
      'الصقه هنا واضغط حفظ لتشغيل نماذج Gemini فورًا.',
    ],
  },
  {
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    configField: 'geminiApiKey',
    keyUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIzaSy...',
    steps: [
      'افتح Google AI Studio وسجّل الدخول.',
      'أنشئ مفتاح API جديد وانسخه.',
      'الصقه هنا لتفعيل النموذج فورًا.',
    ],
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    label: 'OpenAI GPT-4o',
    configField: 'openaiApiKey',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    steps: [
      'افتح لوحة OpenAI API Keys من الرابط أدناه.',
      'اضغط Create new secret key وانسخه.',
      'الصقه هنا واضغط حفظ.',
    ],
  },
  {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-latest',
    label: 'Claude 3.7 Sonnet',
    configField: 'anthropicApiKey',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
    steps: [
      'افتح Anthropic Console → API Keys.',
      'أنشئ مفتاحًا جديدًا وانسخه.',
      'الصقه هنا واضغط حفظ.',
    ],
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct',
    label: 'OpenRouter',
    configField: 'openrouterApiKey',
    keyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-...',
    steps: [
      'افتح OpenRouter Keys وأنشئ مفتاحًا موحدًا لمئات النماذج.',
      'انسخ المفتاح والصقه هنا.',
    ],
  },
  {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    label: 'Groq LPU',
    configField: 'groqApiKey',
    keyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
    steps: [
      'افتح Groq Console وانسخ مفتاح الـ API المجاني.',
      'الصقه هنا واضغط حفظ.',
    ],
  },
  {
    provider: 'ollama',
    model: 'llama3.2',
    label: 'Ollama Local',
    configField: 'ollamaUrl',
    keyUrl: 'https://ollama.com',
    placeholder: 'http://localhost:11434',
    steps: [
      'ثبّت Ollama محليًا على جهازك من الرابط أدناه.',
      'شغّل أي نموذج مفتوح المصدر مثل llama3.2 وتأكد من الرابط المحلي.',
    ],
  },
];

export function AiView({ user, lang }: AiViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded } = useLayout();
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // In-Place API Setup Sheet (opens directly inside AiView when key is missing or clicked!)
  const [setupModel, setSetupModel] = useState<ModelChoice | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [setupFeedback, setSetupFeedback] = useState('');

  const endRef = useRef<HTMLDivElement | null>(null);

  const loadProviderStatus = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; providers: Record<string, unknown> }>('/api/providers');
      const p = res.providers;
      setProviderStatus({
        'local-smart': true,
        gemini: Boolean(p.geminiConfigured),
        openai: Boolean(p.openaiConfigured),
        anthropic: Boolean(p.anthropicConfigured),
        openrouter: Boolean(p.openrouterConfigured),
        groq: Boolean(p.groqConfigured),
        ollama: Boolean(p.ollamaUrl),
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProviderStatus();
  }, [loadProviderStatus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, loading]);

  const currentChoice = MODEL_CHOICES[selectedIdx] || MODEL_CHOICES[0];

  function openSetupForProvider(providerName: string) {
    const found = MODEL_CHOICES.find(m => m.provider === providerName && m.configField);
    if (!found) return;
    setApiKeyDraft(found.provider === 'ollama' ? 'http://localhost:11434' : '');
    setSetupFeedback('');
    setSetupModel(found);
  }

  async function saveInlineApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!setupModel?.configField || !apiKeyDraft.trim()) return;
    await apiPost('/api/providers', { [setupModel.configField]: apiKeyDraft.trim() });
    await loadProviderStatus();
    setSetupFeedback('تم الحفظ بنجاح — النموذج جاهز الآن.');
    setTimeout(() => {
      setSetupModel(null);
      setSetupFeedback('');
    }, 900);
  }

  async function sendPrompt(textToSend: string, reuseLastUser = false) {
    const clean = textToSend.trim();
    if (!clean || loading) return;
    setPrompt('');
    setComposerFocused(false);

    if (!reuseLastUser) {
      setTurns(prev => [...prev, { id: `u_${Date.now()}`, role: 'user', content: clean }]);
    }
    setLoading(true);

    try {
      const res = await apiPost<{
        ok: boolean;
        reply: string;
        providerUsed: string;
        needsApiKey?: boolean;
        missingProvider?: string;
      }>('/api/ai/chat', {
        userId: user.id,
        prompt: clean,
        provider: currentChoice.provider,
        model: currentChoice.model,
        source: 'ai_tab',
        explicitUserConsent: true,
      });

      setTurns(prev => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          provider: res.providerUsed,
          feedback: null,
          needsApiKey: res.needsApiKey,
          missingProvider: res.missingProvider,
        },
      ]);

      if (res.needsApiKey && res.missingProvider) {
        openSetupForProvider(res.missingProvider);
      }
    } catch (e) {
      setTurns(prev => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: e instanceof Error ? e.message : 'تعذر الاتصال بالمساعد.',
          feedback: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function toggleFeedback(id: string, val: 'up' | 'down') {
    setTurns(prev =>
      prev.map(t => (t.id === id ? { ...t, feedback: t.feedback === val ? null : val } : t))
    );
  }

  function regenerateFrom(aiIdx: number) {
    for (let i = aiIdx - 1; i >= 0; i--) {
      if (turns[i].role === 'user') {
        sendPrompt(turns[i].content, true);
        break;
      }
    }
  }

  return (
    <div
      onClick={() => {
        setModelMenuOpen(false);
        setComposerFocused(false);
        setMobileNavExpanded(false);
      }}
      className="h-full w-full bg-black text-[#F5F5F7] relative flex flex-col overflow-hidden"
    >
      {/* FLOATING TOP MODEL SELECTOR PILL (Zero Top Bar / Zero Header Strip!) */}
      <div
        onClick={e => e.stopPropagation()}
        className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none"
      >
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setModelMenuOpen(v => !v)}
            className="h-9 px-3.5 rounded-full bg-[#0A0A0D]/90 backdrop-blur-md border border-white/[0.1] hover:border-white/25 text-xs font-medium text-[#F5F5F7] flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                providerStatus[currentChoice.provider] ? 'bg-[#22C55E]' : 'bg-[#71717A]'
              }`}
            />
            <span>{currentChoice.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>

          {modelMenuOpen && (
            <div className="absolute top-11 start-0 w-[260px] rounded-2xl bg-[#08080B]/96 backdrop-blur-xl border border-white/[0.12] p-1.5 space-y-0.5 z-40">
              {MODEL_CHOICES.map((m, idx) => {
                const configured = Boolean(providerStatus[m.provider]);
                const active = idx === selectedIdx;
                return (
                  <div
                    key={`${m.provider}-${m.model}`}
                    className={`rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                      active ? 'bg-white/[0.1] text-white font-semibold' : 'text-[#D4D4D8] hover:bg-white/[0.05]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIdx(idx);
                        setModelMenuOpen(false);
                      }}
                      className="flex-1 flex items-center gap-2 text-start cursor-pointer min-w-0"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${configured ? 'bg-[#22C55E]' : 'bg-[#52525B]'}`} />
                      <span className="truncate">{m.label}</span>
                    </button>

                    {m.configField && (
                      <button
                        type="button"
                        onClick={() => {
                          setModelMenuOpen(false);
                          openSetupForProvider(m.provider);
                        }}
                        title="إضافة مفتاح API"
                        className="px-2 py-0.5 rounded-full bg-white/[0.07] hover:bg-white hover:text-black text-[10px] text-[#A1A1AA] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                      >
                        <KeyRound className="w-2.5 h-2.5" />
                        <span>{configured ? 'تعديل' : 'API'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => setTurns([])}
            className="pointer-events-auto h-9 px-3 rounded-full bg-[#0A0A0D]/90 backdrop-blur-md border border-white/[0.1] hover:border-white/25 text-xs text-[#D4D4D8] hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>جديد</span>
          </button>
        )}
      </div>

      {/* Main Scrollable Gemini / ChatGPT Stage (Zero Horizontal Dividers Between Messages!) */}
      <div className="flex-1 overflow-y-auto px-4 pt-16 pb-32">
        <div className="max-w-[740px] mx-auto min-h-full flex flex-col">
          {turns.length === 0 ? (
            /* Pure Minimal Open Canvas — Zero Cluttered Card Grid! */
            <div className="my-auto flex flex-col items-center text-center space-y-5 px-4">
              <h1
                style={{
                  background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 64%, #71717A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
                className="text-3xl sm:text-4xl font-semibold tracking-tight"
              >
                {lang === 'ar' ? `مرحبًا، ${user.displayName.split(' ')[0]}` : `Hello, ${user.displayNameEn.split(' ')[0]}`}
              </h1>

              {/* Only 3 Whisper-Minimal Floating Pills (Zero Boxes/Cards!) */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-[520px]">
                {[
                  'صياغة رسالة احترافية مختصرة',
                  'فكرة فيديو ريلز مبتكرة',
                  'ملخص سريع للتصميم الحديث',
                ].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => sendPrompt(chip)}
                    className="px-3.5 py-1.5 rounded-full bg-[#0A0A0D] border border-white/[0.09] hover:border-white/25 text-xs text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Exact ChatGPT / Gemini Conversation Flow (Zero Dividers, Clean Spacing + Like/Dislike/Copy/Regenerate) */
            <div className="space-y-7 pt-4">
              {turns.map((t, idx) =>
                t.role === 'user' ? (
                  <div key={t.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-3xl rounded-ee-md bg-[#16161A] px-4 py-2.5 text-[14.5px] leading-relaxed text-[#F5F5F7]">
                      {t.content}
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <LmBrandMark size={26} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="text-[14.5px] leading-[1.75] text-[#F5F5F7] space-y-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                      </div>

                      {t.needsApiKey && t.missingProvider && (
                        <button
                          type="button"
                          onClick={() => openSetupForProvider(t.missingProvider!)}
                          className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>فتح دليل ربط API لـ {t.missingProvider.toUpperCase()}</span>
                        </button>
                      )}

                      {/* Gemini / ChatGPT Feedback & Utility Row: Copy | Like | Dislike | Regenerate */}
                      <div className="flex items-center gap-1 text-[#71717A] pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(t.id, t.content)}
                          title="نسخ"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.06] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          {copiedId === t.id ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFeedback(t.id, 'up')}
                          title="إعجاب"
                          className={`w-7 h-7 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors ${
                            t.feedback === 'up' ? 'text-white bg-white/[0.1]' : 'hover:text-white'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFeedback(t.id, 'down')}
                          title="عدم إعجاب"
                          className={`w-7 h-7 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors ${
                            t.feedback === 'down' ? 'text-[#EF4444] bg-white/[0.08]' : 'hover:text-white'
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => regenerateFrom(idx)}
                          title="إعادة التوليد"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.06] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {t.provider && (
                          <span className="ms-2 text-[10.5px] font-mono-num text-[#52525B]">{t.provider}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex items-center gap-3">
                  <LmBrandMark size={26} />
                  <span className="text-xs text-[#71717A]">جارٍ التفكير...</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* FLOATING BOTTOM COMPOSER + MOBILE MORPHING NAV PILL */}
      <div
        onClick={e => e.stopPropagation()}
        className="pointer-events-none absolute bottom-4 inset-x-3.5 md:inset-x-6 z-20 flex justify-center"
      >
        <div className="pointer-events-auto w-full max-w-[700px] flex items-center gap-2">
          <MobileInlineNavTrigger lang={lang} />
          {!mobileNavExpanded && (
            <div className="flex-1 min-w-0">
              <ObsidianComposerPill
                value={prompt}
                onChange={setPrompt}
                onSubmit={e => {
                  e.preventDefault();
                  sendPrompt(prompt);
                }}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setTimeout(() => setComposerFocused(false), 140)}
                placeholder={lang === 'ar' ? 'اسأل LM AI...' : 'Ask LM AI...'}
                disabled={!prompt.trim() || loading}
              />
            </div>
          )}
        </div>
      </div>

      {/* BUILT-IN INTERACTIVE API KEY SETUP GUIDE (Direct Link + Steps + In-Place Save!) */}
      {setupModel && (
        <div
          onClick={() => setSetupModel(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={saveInlineApiKey}
            className="w-full max-w-[440px] rounded-2xl bg-[#07070A] border border-white/[0.14] p-5 space-y-4 text-start"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <KeyRound className="w-4 h-4" />
                <span>ربط {setupModel.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setSetupModel(null)}
                className="text-[#71717A] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {setupModel.steps && (
              <ol className="space-y-2 text-xs text-[#D4D4D8] list-decimal list-inside leading-relaxed">
                {setupModel.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}

            {setupModel.keyUrl && (
              <a
                href={setupModel.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs text-white flex items-center justify-between transition-colors"
              >
                <span dir="ltr" className="font-mono-num truncate">{setupModel.keyUrl}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 ms-2" />
              </a>
            )}

            <div className="flex items-center gap-2">
              <input
                type={setupModel.provider === 'ollama' ? 'text' : 'password'}
                dir="ltr"
                value={apiKeyDraft}
                onChange={e => setApiKeyDraft(e.target.value)}
                placeholder={setupModel.placeholder || 'API Key...'}
                className="flex-1 h-11 rounded-full bg-black border border-white/[0.12] px-4 text-xs font-mono-num text-white placeholder:text-[#52525B] outline-none focus:border-white/30"
              />
              <ChromeArrowButton type="submit" disabled={!apiKeyDraft.trim()} size={42} />
            </div>

            {setupFeedback && <div className="text-xs text-[#22C55E] px-2">{setupFeedback}</div>}
          </form>
        </div>
      )}
    </div>
  );
}
