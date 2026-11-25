import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Server,
  CheckCircle2,
  XCircle,
  Save,
  RefreshCw,
  Layers,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';

const BLUEPRINT_MATRIX = [
  { domain: 'المراسلة (Messaging)', project: 'Matrix + Synapse / Element X', license: 'AGPL-3.0', risk: 'copyleft', status: 'جاهز للربط بالمرحلة الثانية', url: 'https://github.com/element-hq/synapse' },
  { domain: 'المراسلة (Messaging)', project: 'Tinode', license: 'GPL-3.0 / Apache 2.0', risk: 'mixed', status: 'مرشح بديل سريع بـ Go', url: 'https://github.com/tinode/chat' },
  { domain: 'المجتمعات', project: 'Zulip', license: 'Apache 2.0', risk: 'safe', status: 'مرجع تنظيم المجتمعات', url: 'https://github.com/zulip/zulip' },
  { domain: 'الذكاء الاصطناعي', project: 'Google @google/genai + Multi-API', license: 'Apache 2.0', risk: 'safe', status: 'مدمج ويعمل الآن', url: 'https://github.com/googleapis/js-genai' },
  { domain: 'الذكاء الاصطناعي', project: 'LibreChat / AnythingLLM / Langflow / RAGFlow', license: 'MIT / Apache 2.0', risk: 'safe', status: 'خطة الوكلاء والـ RAG', url: 'https://github.com/LibreChat-AI/LibreChat' },
  { domain: 'تشغيل النماذج', project: 'Ollama / vLLM / SGLang', license: 'MIT / Apache 2.0', risk: 'safe', status: 'Ollama جاهز للربط محليًا الآن', url: 'https://github.com/ollama/ollama' },
  { domain: 'الفيديوهات القصيرة', project: 'Loops / PeerTube', license: 'AGPL-3.0', risk: 'copyleft', status: 'مرجع UX — النسخة الحالية كود LM خاص', url: 'https://github.com/joinloops/loops-server' },
  { domain: 'البث والمكالمات', project: 'LiveKit + WebRTC', license: 'Apache 2.0', risk: 'safe', status: 'WebRTC مدمج + موصل LiveKit جاهز', url: 'https://github.com/livekit/livekit' },
  { domain: 'البث واسع النطاق', project: 'OvenMediaEngine + FFmpeg', license: 'AGPL-3.0 / LGPL', risk: 'copyleft', status: 'توسّع الملايين بعد الاستثمار', url: 'https://github.com/OvenMediaLabs/OvenMediaEngine' },
  { domain: 'الدفتر المالي', project: 'Blnk Finance / Formance Ledger', license: 'Apache 2.0 / MIT', risk: 'safe', status: 'بنية قيد مزدوج مدمجة + موصل Blnk', url: 'https://github.com/blnkfinance/blnk' },
  { domain: 'الاشتراكات والدفع', project: 'Kill Bill / Hyperswitch', license: 'Apache 2.0', risk: 'safe', status: 'خطة الفوترة بعد التراخيص', url: 'https://github.com/killbill/killbill' },
  { domain: 'الاستثمار والرسوم', project: 'TradingView Lightweight Charts', license: 'Apache 2.0', risk: 'safe', status: 'مدمج ويعمل الآن فعليًا', url: 'https://github.com/tradingview/lightweight-charts' },
  { domain: 'البحث الشامل', project: 'Meilisearch / OpenSearch', license: 'MIT / Apache 2.0', risk: 'safe', status: 'بحث SQLite مدمج + موصل Meilisearch', url: 'https://github.com/meilisearch/meilisearch' },
];

export function ApiHubView() {
  const { lang, toast } = useApp();
  const isAr = lang === 'ar';

  const [tab, setTab] = useState<'keys' | 'blueprint'>('keys');
  const [form, setForm] = useState({
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    openrouterApiKey: '',
    groqApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    livekitUrl: '',
    livekitApiKey: '',
    livekitApiSecret: '',
    meilisearchUrl: '',
    blnkUrl: '',
    matrixUrl: '',
    defaultProvider: 'local-smart',
  });
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ providers: Record<string, unknown> }>('/api/providers').then(d => {
      const p = d.providers;
      setForm(prev => ({
        ...prev,
        geminiApiKey: String(p.geminiMasked || ''),
        openaiApiKey: String(p.openaiMasked || ''),
        anthropicApiKey: String(p.anthropicMasked || ''),
        openrouterApiKey: String(p.openrouterMasked || ''),
        groqApiKey: String(p.groqMasked || ''),
        ollamaUrl: String(p.ollamaUrl || 'http://localhost:11434'),
        livekitUrl: String(p.livekitUrl || ''),
        meilisearchUrl: String(p.meilisearchUrl || ''),
        blnkUrl: String(p.blnkUrl || ''),
        matrixUrl: String(p.matrixUrl || ''),
        defaultProvider: String(p.defaultProvider || 'local-smart'),
      }));
      setStatusMap({
        gemini: Boolean(p.geminiConfigured),
        openai: Boolean(p.openaiConfigured),
        anthropic: Boolean(p.anthropicConfigured),
        openrouter: Boolean(p.openrouterConfigured),
        groq: Boolean(p.groqConfigured),
        livekit: Boolean(p.livekitConfigured),
      });
    });
  }, []);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/providers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const refreshed = await api<{ providers: Record<string, unknown> }>('/api/providers');
      setStatusMap({
        gemini: Boolean(refreshed.providers.geminiConfigured),
        openai: Boolean(refreshed.providers.openaiConfigured),
        anthropic: Boolean(refreshed.providers.anthropicConfigured),
        openrouter: Boolean(refreshed.providers.openrouterConfigured),
        groq: Boolean(refreshed.providers.groqConfigured),
        livekit: Boolean(refreshed.providers.livekitConfigured),
      });
      toast(isAr ? 'تم حفظ مفاتيح الـ API محليًا (معزولة خارج Git)' : 'API configuration saved locally (excluded from Git)', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function pingTarget(target: string) {
    const res = await api<{ ok: boolean; detail: string }>('/api/providers/test', {
      method: 'POST',
      body: JSON.stringify({ target }),
    });
    setTestResults(prev => ({ ...prev, [target]: res }));
    toast(res.detail, res.ok ? 'success' : 'warning');
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-5">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[var(--lm-accent)]" />
              {isAr ? 'مركز ربط الـ APIs والمشاريع المفتوحة المصدر' : 'Multi-Provider API Hub & Open-Source Connectors'}
            </h1>
            <p className="text-xs text-[var(--lm-text-secondary)] mt-0.5">
              {isAr
                ? 'أضف مفاتيح API من المنصات الكبرى أو اربط خوادمك المفتوحة المصدر محليًا فورًا — تُحفظ المفاتيح محليًا فقط ولا تُرفع أبدًا على GitHub.'
                : 'Plug in frontier AI APIs or local open-source engines — keys stay strictly local and gitignored.'}
            </p>
          </div>

          <div className="flex gap-1.5 p-1 rounded-xl bg-[var(--lm-surface)] border border-[var(--lm-border)]">
            <button
              onClick={() => setTab('keys')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === 'keys' ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)]' : 'text-[var(--lm-text-secondary)]'
              }`}
            >
              {isAr ? 'إعدادات الـ APIs والموصلات' : 'API Keys & Connectors'}
            </button>
            <button
              onClick={() => setTab('blueprint')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === 'blueprint' ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)]' : 'text-[var(--lm-text-secondary)]'
              }`}
            >
              {isAr ? 'مصفوفة الـ Open-Source والتراخيص' : 'Open-Source & License Matrix'}
            </button>
          </div>
        </div>

        {tab === 'keys' ? (
          <form onSubmit={saveConfig} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* AI Providers Column */}
            <div className="lg:col-span-7 lm-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">{isAr ? 'مزودو الذكاء الاصطناعي (Multi-Provider LM AI)' : 'AI Model Providers'}</h2>
                <span className="text-[10px] font-mono-num text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> data/providers.json (.gitignore)
                </span>
              </div>

              <div>
                <label className="block text-xs text-[var(--lm-text-secondary)] mb-1">
                  {isAr ? 'المزود الافتراضي في LM AI' : 'Default Active Provider'}
                </label>
                <select
                  value={form.defaultProvider}
                  onChange={(e) => setForm({ ...form, defaultProvider: e.target.value })}
                  className="lm-input w-full rounded-xl px-3 py-2 text-xs"
                >
                  <option value="local-smart">LM Local Smart Engine (Zero-Key)</option>
                  <option value="gemini">Google Gemini (@google/genai)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openrouter">OpenRouter (200+ Models)</option>
                  <option value="groq">Groq Ultra-Fast</option>
                  <option value="ollama">Ollama (Local Offline)</option>
                </select>
              </div>

              {[
                { key: 'geminiApiKey', statusKey: 'gemini', label: 'Google Gemini API Key (@google/genai)', placeholder: 'AIza...', testable: 'gemini' },
                { key: 'openaiApiKey', statusKey: 'openai', label: 'OpenAI API Key (GPT-4o / o3)', placeholder: 'sk-...', testable: null },
                { key: 'anthropicApiKey', statusKey: 'anthropic', label: 'Anthropic Claude API Key', placeholder: 'sk-ant-...', testable: null },
                { key: 'openrouterApiKey', statusKey: 'openrouter', label: 'OpenRouter API Key (Llama / DeepSeek / Qwen)', placeholder: 'sk-or-...', testable: null },
                { key: 'groqApiKey', statusKey: 'groq', label: 'Groq API Key (Ultra-Low Latency)', placeholder: 'gsk_...', testable: null },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-[var(--lm-text-secondary)]">{item.label}</label>
                    <span className={`text-[10px] font-mono-num ${statusMap[item.statusKey] ? 'text-emerald-400' : 'text-[var(--lm-text-muted)]'}`}>
                      {statusMap[item.statusKey] ? '● CONFIGURED' : '○ OPTIONAL'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      dir="ltr"
                      value={(form as Record<string, string>)[item.key]}
                      onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                      placeholder={item.placeholder}
                      className="lm-input flex-1 rounded-xl px-3 py-2 text-xs font-mono-num"
                    />
                    {item.testable && (
                      <button
                        type="button"
                        onClick={() => pingTarget(item.testable!)}
                        className="lm-btn-ghost px-3 rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" /> {isAr ? 'اختبار' : 'Test'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="submit"
                disabled={saving}
                className="lm-btn-primary w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الإعدادات محليًا وتفعيلها فورًا' : 'Save & Activate Locally')}
              </button>
            </div>

            {/* Open-Source Self-Hosted Engines Column */}
            <div className="lg:col-span-5 lm-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                {isAr ? 'موصلات المحركات المفتوحة المصدر المحلية' : 'Local Open-Source Engine Bridges'}
              </h2>
              <p className="text-[11px] text-[var(--lm-text-muted)] leading-relaxed">
                {isAr
                  ? 'لو شغّلت أي محرك من الـ Blueprint على جهازك (مثل Ollama أو Meilisearch أو Blnk أو Synapse)، ضع عنوانه هنا واضغط اختبار للربط الفوري.'
                  : 'Connect locally running open-source engines from the LM Blueprint anytime.'}
              </p>

              {[
                { key: 'ollamaUrl', test: 'ollama', label: 'Ollama Local Server (MIT)', placeholder: 'http://localhost:11434' },
                { key: 'livekitUrl', test: null, label: 'LiveKit WebRTC Server (Apache 2.0)', placeholder: 'wss://your-livekit-instance' },
                { key: 'meilisearchUrl', test: 'meilisearch', label: 'Meilisearch Engine (MIT)', placeholder: 'http://localhost:7700' },
                { key: 'blnkUrl', test: 'blnk', label: 'Blnk Financial Ledger (Apache 2.0)', placeholder: 'http://localhost:5001' },
                { key: 'matrixUrl', test: 'matrix', label: 'Matrix Synapse Homeserver (AGPL-3.0)', placeholder: 'http://localhost:8008' },
              ].map((eng) => (
                <div key={eng.key} className="space-y-1">
                  <label className="block text-xs text-[var(--lm-text-secondary)]">{eng.label}</label>
                  <div className="flex gap-2">
                    <input
                      dir="ltr"
                      value={(form as Record<string, string>)[eng.key]}
                      onChange={(e) => setForm({ ...form, [eng.key]: e.target.value })}
                      placeholder={eng.placeholder}
                      className="lm-input flex-1 rounded-xl px-3 py-2 text-xs font-mono-num"
                    />
                    {eng.test && (
                      <button
                        type="button"
                        onClick={() => pingTarget(eng.test!)}
                        className="lm-btn-ghost px-3 rounded-xl text-xs cursor-pointer shrink-0"
                      >
                        {isAr ? 'فحص' : 'Ping'}
                      </button>
                    )}
                  </div>
                  {eng.test && testResults[eng.test] && (
                    <div className={`text-[10px] flex items-center gap-1 ${testResults[eng.test].ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {testResults[eng.test].ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{testResults[eng.test].detail}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </form>
        ) : (
          /* OPEN-SOURCE BLUEPRINT & LICENSE MATRIX */
          <div className="lm-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--lm-accent)]" />
                {isAr ? 'تقييم وتراخيص مشاريع الـ Open-Source Blueprint وخطة التوسع' : 'Open-Source Blueprint License & Scaling Matrix'}
              </h2>
              <span className="text-[11px] text-[var(--lm-text-muted)]">
                {isAr ? 'جاهز للعرض الفني أمام المستثمرين (Technical Due Diligence)' : 'Investor Technical Due Diligence Ready'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-[var(--lm-border)] text-[var(--lm-text-muted)] text-[11px]">
                    <th className="py-2.5 px-2 text-start">{isAr ? 'القسم' : 'Domain'}</th>
                    <th className="py-2.5 px-2 text-start">{isAr ? 'المشروع المفتوح المصدر' : 'Open-Source Engine'}</th>
                    <th className="py-2.5 px-2 text-start">{isAr ? 'الترخيص' : 'License'}</th>
                    <th className="py-2.5 px-2 text-start">{isAr ? 'الحالة داخل LM' : 'Integration Status'}</th>
                    <th className="py-2.5 px-2 text-end">GitHub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lm-border)]">
                  {BLUEPRINT_MATRIX.map((row) => (
                    <tr key={row.project} className="hover:bg-[var(--lm-surface-2)]">
                      <td className="py-2.5 px-2 font-medium">{row.domain}</td>
                      <td className="py-2.5 px-2 font-mono-num text-[11px]">{row.project}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`font-mono-num text-[10px] px-2 py-0.5 rounded border ${
                            row.risk === 'safe'
                              ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-400'
                              : row.risk === 'mixed'
                              ? 'bg-amber-500/12 border-amber-500/35 text-amber-300'
                              : 'bg-red-500/12 border-red-500/35 text-red-400'
                          }`}
                        >
                          {row.license}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-[var(--lm-text-secondary)]">{row.status}</td>
                      <td className="py-2.5 px-2 text-end">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--lm-accent)] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
