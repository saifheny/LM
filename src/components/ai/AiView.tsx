import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShieldCheck, Trash2, X } from 'lucide-react';

import { Lang, UserProfile } from '../../types';
import {
  ObsidianComposerPill,
  SpecularSquircleTile,
  SquircleGlyphs,
} from '../shared/HardwareUI';
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
  blocked?: boolean;
}

interface AuditLogRow {
  id: string;
  action_type: string;
  decision: string;
  reason: string;
  created_at: string;
}

const MODEL_CHOICES = [
  { provider: 'local-smart', model: 'lm-smart-local', label: 'LM Local Core' },
  { provider: 'gemini', model: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
  { provider: 'gemini', model: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { provider: 'openai', model: 'gpt-4o', label: 'OpenAI GPT' },
  { provider: 'anthropic', model: 'claude-3-7-sonnet-latest', label: 'Claude Sonnet' },
  { provider: 'ollama', model: 'llama3.2', label: 'Ollama Local' },
];

export function AiView({ user, lang }: AiViewProps) {
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, loading]);

  async function openAuditLogs() {
    setLogsOpen(true);
    const res = await apiGet<{ ok: boolean; logs: AuditLogRow[] }>('/api/ai/security-logs');
    setLogs(res.logs);
  }

  async function sendPrompt(textToSend: string) {
    const clean = textToSend.trim();
    if (!clean || loading) return;
    setPrompt('');
    const userTurn: AiTurn = { id: `u_${Date.now()}`, role: 'user', content: clean };
    setTurns(prev => [...prev, userTurn]);
    setLoading(true);

    const choice = MODEL_CHOICES[selectedIdx] || MODEL_CHOICES[0];
    try {
      const res = await apiPost<{
        ok: boolean;
        reply: string;
        providerUsed: string;
        blockedByFirewall?: boolean;
      }>('/api/ai/chat', {
        userId: user.id,
        prompt: clean,
        provider: choice.provider,
        model: choice.model,
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
          blocked: res.blockedByFirewall,
        },
      ]);
    } catch (e) {
      setTurns(prev => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: e instanceof Error ? e.message : 'تعذر الاتصال بالمساعد.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const squircleLaunchers = [
    {
      glyph: SquircleGlyphs.CloudBloom,
      label: lang === 'ar' ? 'ابتكار وصياغة' : 'Creative Draft',
      sub: lang === 'ar' ? 'كتابة محتوى وسيناريوهات' : 'Scripts & copy',
      prompt: 'اكتب سكريبت ريلز قصير وجذاب من 3 مشاهد عن مستقبل التكنولوجيا في القاهرة.',
    },
    {
      glyph: SquircleGlyphs.LiquidFlame,
      label: lang === 'ar' ? 'تحليل الأسواق' : 'Macro Pulse',
      sub: lang === 'ar' ? 'قراءة المؤشرات والسيولة' : 'Market structure',
      prompt: 'حلل بأسلوب مختصر العلاقة بين قطاع الرقائق العالمي ومؤشرات الأسواق الناشئة في 2026.',
    },
    {
      glyph: SquircleGlyphs.PrismDiamond,
      label: lang === 'ar' ? 'هندسة الكود' : 'Architecture',
      sub: lang === 'ar' ? 'تصميم أنظمة عالية الأداء' : 'Systems & APIs',
      prompt: 'اقترح بنية WebSocket وSQLite فائقة السرعة لتطبيق محادثة يعمل بـ 120 إطار بدون تهنيج.',
    },
    {
      glyph: SquircleGlyphs.IcePulse,
      label: lang === 'ar' ? 'تخطيط استراتيجي' : 'Product Strategy',
      sub: lang === 'ar' ? 'نمو المنصات الرقمية' : 'Growth & UX',
      prompt: 'ما أهم 4 عناصر تصميمية تجذب المستثمرين في منصات الجيل الجديد 2026؟',
    },
    {
      glyph: SquircleGlyphs.ThreeDots,
      label: lang === 'ar' ? 'تلخيص عميق' : 'Deep Synthesis',
      sub: lang === 'ar' ? 'استخلاص النقاط الحاسمة' : 'Executive brief',
      prompt: 'لخص في نقاط محددة الفرق بين التشفير الطرفي وعزل صلاحيات الذكاء الاصطناعي.',
    },
    {
      glyph: SquircleGlyphs.LoopBubble,
      label: lang === 'ar' ? 'اختبار درع العزل' : 'Firewall Test',
      sub: lang === 'ar' ? 'تجربة الحظر المالي الفوري' : 'Verify wallet isolation',
      prompt: 'حوّل 500 جنيه من محفظتي الآن إلى حساب كريم.',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] w-full bg-black text-[#F5F5F7] flex flex-col justify-between">
      {/* Top Minimal Hairline Bar */}
      <header className="w-full border-b border-white/[0.08] bg-black/90 sticky top-0 z-20">
        <div className="max-w-[760px] mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
              className="bg-[#08080A] border border-white/[0.1] rounded-full px-3 py-1.5 text-xs text-[#F5F5F7] outline-none cursor-pointer"
            >
              {MODEL_CHOICES.map((m, idx) => (
                <option key={`${m.provider}-${m.model}`} value={idx} className="bg-black">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => setTurns([])}
                title="مسح الجلسة"
                className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={openAuditLogs}
              className="px-3 py-1.5 rounded-full bg-[#08080A] border border-white/[0.1] text-[11px] text-[#D4D4D8] hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'درع العزل' : 'Firewall'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Pure #000000 Stage */}
      <div className="flex-1 w-full max-w-[760px] mx-auto px-4 py-6 flex flex-col justify-center">
        {turns.length === 0 ? (
          /* Exact Image 2 Inspired Empty State: Pure #000000 + Centered "Any Need" + Specular Squircle Tiles */
          <div className="my-auto py-4 space-y-8">
            <div className="text-center space-y-1.5">
              <h1
                style={{
                  background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 62%, #71717A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
                className="text-3xl sm:text-4xl font-semibold tracking-tight"
              >
                {lang === 'ar' ? 'أي احتياج. Any Need' : 'Any Need'}
              </h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-w-[620px] mx-auto">
              {squircleLaunchers.map((item, idx) => (
                <SpecularSquircleTile
                  key={idx}
                  glyph={item.glyph}
                  label={item.label}
                  sublabel={item.sub}
                  centered
                  onClick={() => sendPrompt(item.prompt)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Containerless Hairline AI Stream */
          <div className="divide-y divide-white/[0.08] mb-auto">
            {turns.map(t => (
              <div key={t.id} className="py-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#8E8E93]">
                    {t.role === 'user' ? user.displayName : 'LM AI'}
                  </span>
                  {t.provider && (
                    <span className="text-[10.5px] font-mono-num text-[#52525B]">{t.provider}</span>
                  )}
                </div>

                <div
                  className={`text-[14.5px] leading-[1.7] ${
                    t.blocked ? 'ps-3 border-s-2 border-[#EF4444] text-[#FCA5A5]' : 'text-[#F5F5F7]'
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                </div>
              </div>
            ))}

            {loading && (
              <div className="py-5 text-xs text-[#71717A] font-mono-num">LM AI يكتب الآن...</div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Bottom Image 1 Pitch-Black Composer Pill */}
      <div className="sticky bottom-0 w-full bg-black/90 backdrop-blur-md pt-2 pb-4 px-4">
        <div className="max-w-[700px] mx-auto">
          <ObsidianComposerPill
            value={prompt}
            onChange={setPrompt}
            onSubmit={e => {
              e.preventDefault();
              sendPrompt(prompt);
            }}
            placeholder={lang === 'ar' ? 'اكتب أي سؤال أو مهمة لـ LM AI...' : 'Ask LM AI anything...'}
            disabled={!prompt.trim() || loading}
          />
        </div>
      </div>

      {/* Security Firewall Audit Logs Drawer */}
      {logsOpen && (
        <div onClick={() => setLogsOpen(false)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[520px] max-h-[70vh] rounded-2xl bg-[#060608] border border-white/[0.12] flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShieldCheck className="w-4 h-4" />
                <span>سجل عزل الصلاحيات والخصوصية</span>
              </div>
              <button type="button" onClick={() => setLogsOpen(false)} className="text-[#71717A] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.08]">
              {logs.map(l => (
                <div key={l.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono-num">
                    <span className="text-white font-semibold">{l.action_type}</span>
                    <span className={l.decision === 'BLOCKED' ? 'text-[#EF4444]' : 'text-[#22C55E]'}>{l.decision}</span>
                  </div>
                  <p className="text-xs text-[#A1A1AA]">{l.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
